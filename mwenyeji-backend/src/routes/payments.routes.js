const initiateViewingPayment = require("../controllers/payments/initiate_viewing_payment");
const initiateGuestViewingPayment = require("../controllers/payments/initiate_guest_viewing_payment");
const initiateReservationPayment = require("../controllers/payments/initiate_reservation_payment");
const getPaymentStatus = require("../controllers/payments/get_payment_status");
const mpesaCallback = require("../controllers/payments/mpesa_callback");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function paymentsRoutes(fastify) {
  const tenantOpts = { preHandler: [authenticate, requireRole("tenant")] };

  fastify.post("/api/move_in/viewings/initiate-payment", tenantOpts, initiateViewingPayment);
  fastify.post("/api/move_in/viewings/initiate-payment/guest", initiateGuestViewingPayment);
  fastify.post("/api/move_in/reservations/initiate-payment", tenantOpts, initiateReservationPayment);
  fastify.get("/api/move_in/payments/:accountNumber/status", getPaymentStatus);

  // Safaricom webhook — no auth (Daraja can't send a Bearer token), but
  // MPESA_CALLBACK_URL should be kept unguessable/unpublished regardless.
  fastify.post("/api/move_in/payments/mpesa/callback", mpesaCallback);
}

module.exports = paymentsRoutes;
