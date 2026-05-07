const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Import models
const Document = require("./models/Document");
const Notification = require("./models/Notification");

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

const createNotification = async ({ message, type = "info" }) => {
  try {
    const notification = await Notification.create({
      message,
      type,
      read: false,
    });
    io.emit("notification", notification);
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

const processDocument = async (document) => {
  let progress = 0;

  const interval = setInterval(async () => {
    progress += 20;

    if (progress >= 100) {
      clearInterval(interval);
      try {
        const updatedDoc = await Document.findByIdAndUpdate(
          document._id,
          { status: "processed", processingProgress: 100 },
          { new: true }
        );
        io.emit("document-processed", updatedDoc);
        await createNotification({ message: `Processing complete: ${document.name}`, type: "success" });
      } catch (error) {
        console.error("Error updating document:", error);
      }
      return;
    }

    try {
      const updatedDoc = await Document.findByIdAndUpdate(
        document._id,
        { processingProgress: progress },
        { new: true }
      );
      io.emit("processing-progress", { id: document._id, progress });
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  }, 500);
};

app.get("/", (req, res) => {
  res.send("SWS Document Hub API Running");
});

app.get("/api/documents", (req, res) => {
  res.json(documents);async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 });
    res.json(documents);async (req, res) => {
  try {
    if (!req.file) {
      await createNotification({ message: "Upload failed: invalid file type.", type: "error" });
      return res.status(400).json({ error: "Please upload a PDF file." });
    }

    const document = await Document.create({
      name: req.file.originalname,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      status: "processing",
      processingProgress: 0,
    });

    io.emit("document-uploaded", document);
    processDocument(document);

    res.status(201).json(document);
  } catch (error) {
    await io.emit("document-uploaded", document);
    processDocument(document);

    res.status(201).json(document);
  } catch (error) {
    createNotification({ message: "Upload failed due to server error.", type: "error" });
    res.status(500).json({ error: "Upload failed." });
  }
});
async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }

    res.download(path.join(uploadDir, document.filename), document.originalName);
  } catch (error) {
    res.status(500).json({ error: "Download failed." });
  }
  res.download(path.join(uploadDir, document.filename), document.originalName);
});

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (error) {async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }async (req, res) => {
  try {
    await Notification.updateMany({}, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notifications." });
  }
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification." });
  }tifications.find(n => n._id === req.params.id);
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
