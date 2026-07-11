const crypto = require("crypto");

function generateFacilityId() {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(8).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(`${timestamp}-${random}`)
    .digest("hex");
  return parseInt(hash.slice(0, 8), 16).toString().slice(0, 6).padStart(6, "0");
}

module.exports = generateFacilityId;
