const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// In-memory storage for demo purposes (no database required)
let documents = [];
let notifications = [];
let nextDocId = 1;
let nextNotifId = 1;
  cors: {
    origin: "*",
  },
});

const uploadDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// No database connection needed - using in-memory storage

const createNotification = ({ message, type = "info" }) => {
  const notification = {
    _id: `notif_${nextNotifId++}`,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(notification);
  io.emit("notification", notification);
  return notification;
};

const processDocument = async (document) => {
  let progress = 0;

  const interval = setInterval(() => {
    progress += 20;

    if (progress >= 100) {
      clearInterval(interval);
      const index = documents.findIndex(d => d._id === document._id);
      if (index !== -1) {
        documents[index] = { ...documents[index], status: "processed", processingProgress: 100 };
        io.emit("document-processed", documents[index]);
        createNotification({ message: `Processing complete: ${document.name}`, type: "success" });
      }
      return;
    }

    const index = documents.findIndex(d => d._id === document._id);
    if (index !== -1) {
      documents[index] = { ...documents[index], processingProgress: progress };
      io.emit("processing-progress", { id: document._id, progress });
    }
  }, 500);
};

app.get("/", (req, res) => {
  res.send("SWS Document Hub API Running");
});

app.get("/api/documents", (req, res) => {
  res.json(documents);
});

app.post("/api/documents", upload.single("document"), (req, res) => {
  try {
    if (!req.file) {
      createNotification({ message: "Upload failed: invalid file type.", type: "error" });
      return res.status(400).json({ error: "Please upload a PDF file." });
    }

    const document = {
      _id: `doc_${nextDocId++}`,
      name: req.file.originalname,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      status: "processing",
      processingProgress: 0,
      createdAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
    };

    documents.unshift(document);
    io.emit("document-uploaded", document);
    processDocument(document);

    res.status(201).json(document);
  } catch (error) {
    createNotification({ message: "Upload failed due to server error.", type: "error" });
    res.status(500).json({ error: "Upload failed." });
  }
});

app.get("/api/documents/:id/download", (req, res) => {
  const document = documents.find(d => d._id === req.params.id);
  if (!document) {
    return res.status(404).json({ error: "Document not found." });
  }

  res.download(path.join(uploadDir, document.filename), document.originalName);
});

app.get("/api/notifications", (req, res) => {
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ notifications, unreadCount });
});

app.post("/api/notifications/:id/read", (req, res) => {
  const notification = notifications.find(n => n._id === req.params.id);
  if (!notification) {
    return res.status(404).json({ error: "Notification not found." });
  }
  notification.read = true;
  res.json(notification);
});

app.post("/api/notifications/read-all", (req, res) => {
  notifications.forEach(n => n.read = true);
  res.json({ success: true });
});

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
