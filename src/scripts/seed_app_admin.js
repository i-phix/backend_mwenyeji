const bcrypt = require("bcryptjs");
const db = require("payservedb");

async function seedAppAdmin() {
  await db.connectToMongoDB(
    process.env.MAIN_DB_NAME || "payserve_property",
    process.env.MONGODB_SECURED === "false" ? false : true,
    process.env.MONGODB_USER || "Ps",
    process.env.MONGODB_PASSWORD || "Letmein987",
    process.env.MONGODB_HOST || "127.0.0.1",
    process.env.MONGODB_PORT || "27017",
  );

  const email = "app.admin@payserve.local";
  const password = "Admin12345!";
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.User.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName: "App Admin",
        email,
        phoneNumber: "0700000001",
        type: "Company", // <-- matches platform: 'App'
        role: "admin",
        password: hashedPassword,
        isEnabled: true,
      },
    },
    { upsert: true, new: true },
  ).select("email type role");

  console.log("App admin ready:");
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${password}`);
  process.exit(0);
}

seedAppAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
