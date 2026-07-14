const { Storage } = require("@google-cloud/storage");

// Minimal GCS upload helper for the new backend. Uploads a buffer under
// `folder/` with a collision-proof name and returns its public URL.
// Requires GCS_BUCKET_NAME + GOOGLE_APPLICATION_CREDENTIALS (or default
// application credentials on Cloud Run) to be set — see .env.example.
let storage;
function getStorage() {
  if (!storage) storage = new Storage();
  return storage;
}

async function uploadBuffer(buffer, { folder = "uploads", filename, contentType }) {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error("GCS_BUCKET_NAME is not configured");

  const bucket = getStorage().bucket(bucketName);
  const safeName = (filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType: contentType || "application/octet-stream",
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

module.exports = { uploadBuffer };
