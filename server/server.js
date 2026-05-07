const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const Document = require("./models/Document");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
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

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("MongoDB Connected");
    })
    .catch((err) => {
      console.log("MongoDB connection error:", err.message);
    });
} else {
  console.warn("MONGO_URI is not set. MongoDB connection skipped.");
}

const createNotification = async ({ message, type = "info" }) => {
  const notification = await Notification.create({ message, type });
  io.emit("notification", notification);
  return notification;
};

const processDocument = async (document) => {
  let progress = 0;

  const interval = setInterval(async () => {
    progress += 20;

    if (progress >= 100) {
      clearInterval(interval);
      const updatedDoc = await Document.findByIdAndUpdate(
        document._id,
        { status: "processed", processingProgress: 100 },
        { new: true }
      );
      io.emit("document-processed", updatedDoc);
      await createNotification({ message: `Processing complete: ${document.name}`, type: "success" });
      return;
    }

    await Document.findByIdAndUpdate(document._id, { processingProgress: progress });
    io.emit("processing-progress", { id: document._id, progress });
  }, 500);
};

app.get("/", (req, res) => {
  res.send("SWS Document Hub API Running");
});

app.get("/api/documents", async (req, res) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to load documents." });
  }
});

app.post("/api/documents", upload.single("document"), async (req, res) => {
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
      uploadedAt: new Date(),
    });

    io.emit("document-uploaded", document);
    processDocument(document);

    res.status(201).json(document);
  } catch (error) {
    await createNotification({ message: "Upload failed due to server error.", type: "error" });
    res.status(500).json({ error: "Upload failed." });
  }
});

app.get("/api/documents/:id/download", async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }

    res.download(path.join(uploadDir, document.filename), document.originalName);
  } catch (error) {
    res.status(500).json({ error: "Download failed." });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    const unreadCount = await Notification.countDocuments({ read: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: "Unable to load notifications." });
  }
});

app.post("/api/notifications/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: "Unable to update notification." });
  }
});

app.post("/api/notifications/read-all", async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to mark notifications as read." });
  }
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
