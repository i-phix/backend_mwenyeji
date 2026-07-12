const submitApplication = require("../controllers/applications/submit_application");
const submitGuestApplication = require("../controllers/applications/submit_guest_application");
const getMyApplications = require("../controllers/applications/get_my_applications");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function applicationsRoutes(fastify) {
  fastify.post("/api/move_in/applications/submit_guest", submitGuestApplication);
  fastify.post(
    "/api/move_in/applications/submit",
    { preHandler: [authenticate, requireRole("tenant")] },
    submitApplication,
  );
  fastify.get(
    "/api/move_in/applications/my",
    { preHandler: [authenticate, requireRole("tenant")] },
    getMyApplications,
  );
}

module.exports = applicationsRoutes;
