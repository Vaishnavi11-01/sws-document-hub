const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "success", "error"],
      default: "info",
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
