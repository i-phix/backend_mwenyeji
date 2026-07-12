const jwt = require("jsonwebtoken");

const EXPIRES_IN = "7d";

// `role` is one of: "admin" | "landlord" | "tenant" — this is the entire
// authorization model. No JWT "type" enum to keep in sync with a middleware
// exclusion list (the old backend's require_movein_admin.js worked by
// *excluding* two type strings — brittle. This backend's admin routes just
// require role === "admin", explicitly).
function signToken(payload, role) {
  return jwt.sign({ ...payload, role }, process.env.JWT_SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
