const { Storage } = require("@google-cloud/storage");
const path = require("path");

// On Cloud Run, no keyFilename/credentials are needed — the Storage client
// automatically uses the service's attached service account (Application
// Default Credentials). Locally, it'll use `gcloud auth application-default
// login` credentials or GOOGLE_APPLICATION_CREDENTIALS if you've set that up.
//this
const storage = new Storage();

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "mwenyeji";
const bucket = storage.bucket(BUCKET_NAME);

/**
 * Uploads a Buffer to Google Cloud Storage and returns its public URL.
 * Requires the bucket to have `allUsers` granted Storage Object Viewer
 * (public read) — see docs/persistent-media-storage-guide.md.
 *
 * @param {Buffer} buffer       - file contents (e.g. from multer memoryStorage, req.file.buffer)
 * @param {string} originalName - original filename, used only to preserve the extension
 * @param {string} mimetype     - e.g. 'image/jpeg'
 * @param {string} folder       - subfolder inside the bucket, e.g. 'move_in', 'tickets'
 * @returns {Promise<string>}   - public HTTPS URL of the uploaded object
 */
async function uploadBufferToGCS(
  buffer,
  originalName,
  mimetype,
  folder = "misc",
) {
  const ext = path.extname(originalName || "") || "";
  const objectName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const blob = bucket.file(objectName);

  await new Promise((resolve, reject) => {
    const stream = blob.createWriteStream({
      resumable: false,
      contentType: mimetype || "application/octet-stream",
    });
    stream.on("error", reject);
    stream.on("finish", resolve);
    stream.end(buffer);
  });

  return `https://storage.googleapis.com/${bucket.name}/${objectName}`;
}

module.exports = { bucket, uploadBufferToGCS };
