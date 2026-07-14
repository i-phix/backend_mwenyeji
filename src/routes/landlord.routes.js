const getUnits = require("../controllers/landlord/get_units");
const createUnit = require("../controllers/landlord/create_unit");
const updateUnit = require("../controllers/landlord/update_unit");

const getLandlordApplications = require("../controllers/applications/get_landlord_applications");
const respondApplication = require("../controllers/applications/respond_application");

const getLandlordSlots = require("../controllers/viewings/get_landlord_slots");
const createLandlordSlot = require("../controllers/viewings/create_landlord_slot");
const cancelLandlordSlot = require("../controllers/viewings/cancel_landlord_slot");
const getLandlordBookings = require("../controllers/viewings/get_landlord_bookings");
const respondLandlordBooking = require("../controllers/viewings/respond_landlord_booking");

const getLandlordReservations = require("../controllers/reservations/get_landlord_reservations");
const respondLandlordReservation = require("../controllers/reservations/respond_landlord_reservation");

const getLandlordTenancies = require("../controllers/tenancy/get_landlord_tenancies");

const updateUnitFees = require("../controllers/landlord/update_unit_fees");
const getLandlordFeaturedPackages = require("../controllers/landlord/get_featured_packages");
const initiateBoostPayment = require("../controllers/payments/initiate_boost_payment");

const getLandlordDashboard = require("../controllers/dashboard/get_landlord_dashboard");
const getLandlordConversations = require("../controllers/messaging/get_landlord_conversations");
const makeGetMessages = require("../controllers/messaging/get_messages");
const makeSendMessage = require("../controllers/messaging/send_message");

const { authenticate, requireRole } = require("../middlewares/authenticate");

async function landlordRoutes(fastify) {
  const opts = { preHandler: [authenticate, requireRole("landlord")] };

  fastify.get("/api/move_in/landlord/units", opts, getUnits);
  fastify.post("/api/move_in/landlord/units", opts, createUnit);
  fastify.put("/api/move_in/landlord/units/:unitId", opts, updateUnit);

  fastify.get("/api/move_in/landlord/applications", opts, getLandlordApplications);
  fastify.put("/api/move_in/landlord/applications/:id", opts, respondApplication);

  fastify.get("/api/move_in/landlord/viewings/slots", opts, getLandlordSlots);
  fastify.post("/api/move_in/landlord/viewings/slots", opts, createLandlordSlot);
  fastify.delete("/api/move_in/landlord/viewings/slots/:slotId", opts, cancelLandlordSlot);
  fastify.get("/api/move_in/landlord/viewings/bookings", opts, getLandlordBookings);
  fastify.put("/api/move_in/landlord/viewings/bookings/:bookingId", opts, respondLandlordBooking);

  fastify.get("/api/move_in/landlord/reservations", opts, getLandlordReservations);
  fastify.put("/api/move_in/landlord/reservations/:reservationId", opts, respondLandlordReservation);

  fastify.get("/api/move_in/landlord/tenancies", opts, getLandlordTenancies);

  fastify.put("/api/move_in/landlord/units/:unitId/fees", opts, updateUnitFees);
  fastify.get("/api/move_in/landlord/featured-packages", opts, getLandlordFeaturedPackages);
  fastify.post("/api/move_in/landlord/units/:unitId/boost", opts, initiateBoostPayment);

  fastify.get("/api/move_in/landlord/dashboard", opts, getLandlordDashboard);
  fastify.get("/api/move_in/landlord/messaging/conversations", opts, getLandlordConversations);
  fastify.get("/api/move_in/landlord/messaging/conversations/:id/messages", opts, makeGetMessages("landlord"));
  fastify.post("/api/move_in/landlord/messaging/conversations/:id/messages", opts, makeSendMessage("landlord"));
}

module.exports = landlordRoutes;
