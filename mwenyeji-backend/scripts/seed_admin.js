/**
 * Seed the first Mwenyeji admin account into the new standalone database.
 * Usage: node scripts/seed_admin.js
 * Reads MONGODB_URI from .env — double-check it points at the new
 * standalone `mwenyeji` database, not the old payserve_property one.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");

const ADMIN = {
  fullName: "Admin",
  email: "admin@mwenyeji.com",
  password: "Sunrise!1998*Sega",
};

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — check your .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected (db: ${mongoose.connection.name})`);

  const email = ADMIN.email.toLowerCase().trim();
  const hashed = await bcrypt.hash(ADMIN.password, 10);
  const existing = await User.findOne({ email });

  if (existing) {
    existing.password = hashed;
    existing.fullName = ADMIN.fullName;
    existing.isEnabled = true;
    await existing.save();
    console.log(`Updated existing admin: ${email}`);
  } else {
    await new User({ ...ADMIN, email, password: hashed, role: "admin" }).save();
    console.log(`Created admin: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
