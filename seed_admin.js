/**
 * Mwenyeji admin login seed script
 * ─────────────────────────────────────────────────────────────────────────
 * Creates (or updates the password of) one or more Mwenyeji admin accounts
 * in the `User` collection (payserve_property DB) — the same collection and
 * login endpoint (`POST /api/auth/login`) used by the rest of the platform.
 *
 * These accounts pass the Mwenyeji admin routes' `require_movein_admin`
 * check (src/middlewares/require_movein_admin.js — internal filename only,
 * unrelated to the public "Mwenyeji" branding), which only blocks the
 * `MoveInUser` / `MoveInLandlordUser` JWT types — any User with a type from
 * the enum below is treated as platform staff.
 *
 * Connects using MONGODB_URI from .env — whichever database that points at
 * (local or the production Atlas cluster) is what gets seeded. Double-check
 * your .env before running this against production.
 *
 * Usage:
 *   node seed_admin.js
 *
 * Idempotent — running it again updates the password/name on an existing
 * account with the same email instead of erroring.
 */

"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const db = require("payservedb");

// Add more entries here as needed — each just needs a unique email and
// phoneNumber. phoneNumber is required and unique on the User schema; the
// placeholder below is fine to leave as-is unless you want a real number
// tied to this account.
const ADMINS = [
  {
    fullName: "Admin",
    email: "admin@mwenyeji.com",
    phoneNumber: "+254700000001",
    password: "Sunrise!1998*Sega",
  },
];

async function seedAdmins() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — check your .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (db: ${mongoose.connection.name})\n`);

  for (const admin of ADMINS) {
    const email = admin.email.toLowerCase().trim();
    const hashed = await bcrypt.hash(admin.password, 10);

    const existing = await db.User.findOne({ email });

    if (existing) {
      existing.fullName = admin.fullName;
      existing.password = hashed;
      existing.role = "admin";
      existing.type = "Company";
      existing.isEnabled = true;
      await existing.save();
      console.log(`= Updated existing admin: ${email}`);
    } else {
      await new db.User({
        fullName: admin.fullName,
        email,
        phoneNumber: admin.phoneNumber,
        type: "Company",
        role: "admin",
        password: hashed,
        isEnabled: true,
      }).save();
      console.log(`+ Created admin: ${email}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

seedAdmins().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
