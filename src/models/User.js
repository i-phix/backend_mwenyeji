const mongoose = require("mongoose");

// Platform admin/staff. Fully independent of PayServe's User model — no
// shared login, no shared collection. Every account here is Mwenyeji staff,
// full stop; no "any type except X" exclusion logic needed downstream.
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ["admin", "support"], default: "admin" },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
