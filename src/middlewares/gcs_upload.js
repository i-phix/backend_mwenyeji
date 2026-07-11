const multer = require('fastify-multer');

// Buffers files in memory instead of writing to local disk, so they can be
// streamed straight to Google Cloud Storage (see src/utils/gcs.js). Local
// disk on Cloud Run is ephemeral and does not survive container restarts —
// this middleware exists specifically to avoid that trap for Move-In
// listing photo uploads.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
});

module.exports = upload;
