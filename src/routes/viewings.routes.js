const getAvailableSlots = require("../controllers/viewings/get_available_slots");
const bookSlot = require("../controllers/viewings/book_slot");
const bookGuestSlot = require("../controllers/viewings/book_guest_slot");
const cancelBooking = require("../controllers/viewings/cancel_booking");
const getMyBookings = require("../controllers/viewings/get_my_bookings");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function viewingsRoutes(fastify) {
  const tenantOpts = { preHandler: [authenticate, requireRole("tenant")] };

  fastify.get("/api/move_in/viewing/available", getAvailableSlots);
  fastify.post("/api/move_in/viewing/book", tenantOpts, bookSlot);
  fastify.post("/api/move_in/viewing/book_guest", bookGuestSlot);
  fastify.put("/api/move_in/viewing/bookings/cancel/:id", tenantOpts, cancelBooking);
  fastify.get("/api/move_in/viewing/bookings", tenantOpts, getMyBookings);
}

module.exports = viewingsRoutes;
