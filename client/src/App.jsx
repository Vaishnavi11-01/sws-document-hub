import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = "http://localhost:5000";

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function ProgressBar({ value }) {
  return (
    <div className="progress-shell">
      <div className="progress-bar" style={{ width: `${value}%` }} />
      <span>{value}%</span>
    </div>
  );
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [bulkNotice, setBulkNotice] = useState("");
  const [showUploadDetails, setShowUploadDetails] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("Socket connected", socket.id);
    });

    socket.on("document-processed", (doc) => {
      setDocuments((prev) => prev.map((item) => (item._id === doc._id ? doc : item)));
      setNotifications((prev) => [
        {
          _id: `${doc._id}-processed`,
          message: `Processing complete: ${doc.name}`,
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setUnreadCount((count) => count + 1);
    });

    socket.on("processing-progress", ({ id, progress }) => {
      setDocuments((prev) =>
        prev.map((item) => (item._id === id ? { ...item, processingProgress: progress } : item))
      );
    });

    socket.on("document-uploaded", (doc) => {
      setDocuments((prev) => [doc, ...prev]);
    });

    socket.on("notification", (notification) => {
      setNotifications((current) => [notification, ...current]);
      setUnreadCount((count) => count + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      setFetching(true);
      try {
        const response = await fetch(`${API_URL}/api/documents`);
        const data = await response.json();
        setDocuments(data);
      } catch (error) {
        console.error(error);
      } finally {
        setFetching(false);
      }
    };

    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications`);
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch (error) {
        console.error(error);
      }
    };

    fetchDocuments();
    fetchNotifications();
  }, []);

  const updateFileState = (id, partial) => {
    setSelectedFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...partial } : file)));
  };

  const handleFiles = (files) => {
    const incoming = Array.from(files || []);
    const validFiles = incoming.filter((file) => file.type === "application/pdf");
    const invalidCount = incoming.length - validFiles.length;

    if (invalidCount > 0) {
      setUploadError("Only PDF files are supported.");
    }

    const items = validFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      progress: 0,
      status: "pending",
    }));

    setSelectedFiles((prev) => [...prev, ...items]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const uploadFile = (item, batchId, batchSize) => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("document", item.file);
      if (batchId) {
        formData.append("batchId", batchId);
        formData.append("batchSize", String(batchSize));
      }

      xhr.open("POST", `${API_URL}/api/documents`, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          updateFileState(item.id, {
            progress: Math.round((event.loaded / event.total) * 100),
            status: "uploading",
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 201) {
          const document = JSON.parse(xhr.responseText);
          setDocuments((prev) => [document, ...prev]);
          updateFileState(item.id, { progress: 100, status: "complete" });
        } else {
          updateFileState(item.id, { status: "failed" });
          setUploadError("One or more files failed to upload.");
        }
        resolve();
      };

      xhr.onerror = () => {
        updateFileState(item.id, { status: "failed" });
        setUploadError("Network error during upload.");
        resolve();
      };

      xhr.send(formData);
    });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError("Please select PDF files before uploading.");
      return;
    }

    setUploadError("");
    setUploading(true);

    const batchId =
      selectedFiles.length > 3
        ? crypto.randomUUID?.() ?? `batch-${Date.now()}`
        : null;

    if (selectedFiles.length > 3) {
      setBulkNotice(`Upload in progress — processing ${selectedFiles.length} files in background.`);
      setShowUploadDetails(false);
    }

    await Promise.all(selectedFiles.map((file) => uploadFile(file, batchId, selectedFiles.length)));

    setUploading(false);
    if (selectedFiles.length <= 3) {
      setBulkNotice("");
    }
  };

  const toggleNotifications = async () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      try {
        const response = await fetch(`${API_URL}/api/notifications`);
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const markNotificationRead = async (id) => {
    await fetch(`${API_URL}/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllRead = async () => {
    await fetch(`${API_URL}/api/notifications/read-all`, { method: "POST" });
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Document Management</p>
          <h1>SWS Document Hub</h1>
        </div>

        <div className="header-actions">
          <button className="notification-trigger" onClick={toggleNotifications}>
            <span className="bell">🔔</span>
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>
          <div className="status-pill">Live prototype</div>
        </div>

        {notificationsOpen && (
          <div className="notification-panel">
            <div className="notification-panel-header">
              <strong>Notifications</strong>
              <button className="link-button" onClick={markAllRead}>
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="empty-state">No notifications yet.</div>
            ) : (
              notifications.map((note) => (
                <div key={note._id} className={`notification-item ${note.read ? "read" : "unread"}`}>
                  <div>
                    <p>{note.message}</p>
                    <small>{new Date(note.createdAt).toLocaleString()}</small>
                  </div>
                  {!note.read && (
                    <button className="link-button" onClick={() => markNotificationRead(note._id)}>
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </header>

      <main className="content-grid">
        <section className="panel upload-panel">
          <div className="panel-header">
            <h2>Upload company PDFs</h2>
            <p>Select one or more PDF files and track each upload in real time.</p>
          </div>

          <form className="upload-form" onSubmit={handleUpload}>
            <div
              className="file-picker dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <span>Drag & drop PDFs here or click to choose files</span>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="upload-summary">
                <div className="upload-summary-header">
                  <strong>{selectedFiles.length} file(s) selected</strong>
                  {selectedFiles.length > 3 && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setShowUploadDetails((current) => !current)}
                    >
                      {showUploadDetails ? "Hide details" : "Show details"}
                    </button>
                  )}
                </div>

                {(showUploadDetails || selectedFiles.length <= 3) && (
                  <div className="upload-list">
                    {selectedFiles.map((item) => (
                      <div key={item.id} className="upload-row">
                        <div>
                          <strong>{item.file.name}</strong>
                          <p>{formatSize(item.file.size)}</p>
                        </div>
                        <div className="upload-status">{item.status}</div>
                        <ProgressBar value={item.progress} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="btn primary" type="submit" disabled={uploading || selectedFiles.length === 0}>
              {uploading ? "Uploading files..." : "Start upload"}
            </button>

            {bulkNotice && <div className="bulk-notice">{bulkNotice}</div>}
            {uploadError && <div className="notification error">{uploadError}</div>}
          </form>
        </section>

        <section className="panel docs-panel">
          <div className="panel-header">
            <h2>Recent uploads</h2>
            <p>Monitor processing progress and download files after processing.</p>
          </div>

          {fetching ? (
            <div className="loader">Loading documents...</div>
          ) : (
            <div className="table-shell">
              <div className="table-header row">
                <span>Document</span>
                <span>Status</span>
                <span>Progress</span>
                <span>Action</span>
              </div>

              {documents.length === 0 ? (
                <div className="empty-state">No uploaded documents yet.</div>
              ) : (
                documents.map((doc) => (
                  <div className="row doc-row" key={doc._id}>
                    <div>
                      <strong>{doc.name}</strong>
                      <p>{new Date(doc.createdAt).toLocaleString()}</p>
                    </div>
                    <div className={`status-pill-mini ${doc.status}`}>{doc.status}</div>
                    <div className="progress-row">
                      <ProgressBar value={doc.processingProgress || 0} />
                    </div>
                    <div>
                      <a
                        className={`btn tertiary ${doc.status !== "processed" ? "disabled" : ""}`}
                        href={`${API_URL}/api/documents/${doc._id}/download`}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
