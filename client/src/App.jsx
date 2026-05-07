import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
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

    loadDocuments();
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("document", file);

    setUploading(true);

    try {
      const response = await fetch(`${API_URL}/api/documents`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const newDoc = await response.json();
        setDocuments((prev) => [newDoc, ...prev]);
        setFile(null);
      } else {
        alert("Upload failed");
      }
    } catch (error) {
      alert("Upload error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>SWS Document Hub</h1>

      <div style={{ marginTop: "20px", marginBottom: "40px" }}>
        <h2>Upload PDF</h2>
        <form onSubmit={handleUpload}>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ marginRight: "10px" }}
          />
          <button type="submit" disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Recent uploads</h2>

        {fetching ? (
          <div>Loading documents...</div>
        ) : (
          <div>
            {documents.length === 0 ? (
              <div>No uploaded documents yet.</div>
            ) : (
              documents.map((doc) => (
                <div key={doc._id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
                  <strong>{doc.name}</strong>
                  <p>{new Date(doc.createdAt).toLocaleString()}</p>
                  <p>Status: {doc.status}</p>
                  <a href={`${API_URL}/api/documents/${doc._id}/download`}>Download</a>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}