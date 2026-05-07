const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const Document = require("./models/Document");

dotenv.config();

const app = express();

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

    res.status(201).json(document);
  } catch (error) {
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
