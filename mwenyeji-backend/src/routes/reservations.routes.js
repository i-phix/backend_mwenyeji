const createReservation = require("../controllers/reservations/create_reservation");
const createGuestReservation = require("../controllers/reservations/create_guest_reservation");
const getMyReservations = require("../controllers/reservations/get_my_reservations");
const cancelReservation = require("../controllers/reservations/cancel_reservation");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function reservationsRoutes(fastify) {
  const tenantOpts = { preHandler: [authenticate, requireRole("tenant")] };

  fastify.post("/api/move_in/reservations", tenantOpts, createReservation);
  fastify.post("/api/move_in/reservations/guest", createGuestReservation);
  fastify.get("/api/move_in/reservations", tenantOpts, getMyReservations);
  fastify.put("/api/move_in/reservations/cancel/:id", tenantOpts, cancelReservation);
}

module.exports = reservationsRoutes;
