const { verifyToken } = require("../utils/jwt");

// Verifies the Authorization: Bearer <token> header and attaches the decoded
// payload to request.user. Use requireRole() after this to gate by role.
function authenticate(request, reply, done) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return reply.code(401).send({ error: "Missing or invalid Authorization header" });
  }

  try {
    request.user = verifyToken(token);
    done();
  } catch (err) {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
}

// requireRole('admin') -> preHandler array usable as { preHandler: [authenticate, requireRole('admin')] }
function requireRole(...roles) {
  return (request, reply, done) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Forbidden: insufficient role" });
    }
    done();
  };
}

module.exports = { authenticate, requireRole };
