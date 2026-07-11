const authenticateJWT = require("../middlewares/jwt_authentication");
const requireMoveInAccess = require("../middlewares/move_in_landlord_access");
const multer = require("fastify-multer");

const upload = multer({ storage: multer.memoryStorage() });

const get_landlord_facilities = require("../controllers/landlord/facility_management/get_landlord_facilities");
const get_units = require("../controllers/landlord/unit_management/get_units");
const get_landlord_approval_tickets = require("../controllers/landlord/maintenance_approvals/get_tickets_approvals");
const get_landlord_approval_ticket = require("../controllers/landlord/maintenance_approvals/get_ticket_approval");
const approve_ticket = require("../controllers/landlord/maintenance_approvals/approve_ticket");
const deny_ticket = require("../controllers/landlord/maintenance_approvals/deny_ticket");

const get_landlord_income = require("../controllers/landlord/lease_management/get_customer_invoices");
const get_unit_lease_income = require("../controllers/landlord/lease_management/get_unit_lease_income");
const get_statement_of_accounts = require("../controllers/landlord/lease_management/get_statement_of_accounts");

// Move-In
const get_move_in_units        = require("../controllers/landlord/move_in/get_units");
const get_available_units      = require("../controllers/landlord/move_in/get_available_units");
const list_move_in_unit        = require("../controllers/landlord/move_in/list_unit");
const update_move_in_listing   = require("../controllers/landlord/move_in/update_listing");
const get_move_in_bookings     = require("../controllers/landlord/move_in/get_bookings");
const get_move_in_performance  = require("../controllers/landlord/move_in/get_performance");
const get_move_in_applications = require("../controllers/landlord/move_in/get_applications");
const respond_move_in_application = require("../controllers/landlord/move_in/respond_application");
const get_move_in_reservations = require("../controllers/landlord/move_in/get_reservations");
const respond_move_in_reservation = require("../controllers/landlord/move_in/respond_reservation");
const convert_move_in_deal    = require("../controllers/landlord/move_in/convert_deal");
const get_move_in_commissions = require("../controllers/landlord/move_in/get_commissions");
// Move-In Viewing
const create_viewing_slot      = require("../controllers/landlord/move_in/create_slot");
const get_viewing_slots        = require("../controllers/landlord/move_in/get_slots");
const cancel_viewing_slot      = require("../controllers/landlord/move_in/cancel_slot");
const get_viewing_bookings     = require("../controllers/landlord/move_in/get_viewing_bookings");
const respond_viewing_booking  = require("../controllers/landlord/move_in/respond_booking");
// Move-In Messaging
const landlord_get_conversations = require("../controllers/landlord/move_in/get_conversations");
const landlord_get_messages      = require("../controllers/landlord/move_in/get_conv_messages");
const landlord_send_message      = require("../controllers/landlord/move_in/send_message");

async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

    const landlordManagementBaseRoute = "/api/landlord";

    fastify.get(landlordManagementBaseRoute + "/facility_management/get_landlord_facilities", jwt, get_landlord_facilities);
    fastify.get(landlordManagementBaseRoute + "/unit_management/get_units/:facilityId/:customerId", jwt, get_units);
    fastify.get(landlordManagementBaseRoute + "/maintenance_approvals/get_tickets_approvals/:facilityId/:homeOwnerId", jwt, get_landlord_approval_tickets);
    fastify.get(landlordManagementBaseRoute + "/maintenance_approvals/get_ticket_approval/:facilityId/:ticketId", jwt, get_landlord_approval_ticket);
    fastify.post(landlordManagementBaseRoute + "/maintenance_approvals/approve_ticket/:facilityId/:ticketId", jwt, approve_ticket);
    fastify.post(landlordManagementBaseRoute + "/maintenance_approvals/deny_ticket/:facilityId/:ticketId", jwt, deny_ticket);
    fastify.get(landlordManagementBaseRoute + "/lease_management/get_customer_invoices/:facilityId/:homeOwnerId", jwt, get_landlord_income);
    fastify.get(landlordManagementBaseRoute + "/lease_management/get_unit_lease_income/:facilityId/:unitId", jwt, get_unit_lease_income);
    fastify.get(landlordManagementBaseRoute + "/lease_management/get_statement_of_accounts/:facilityId/:tenantId/:homeOwnerId/:unitId", jwt, get_statement_of_accounts);

    // Move-In routes (require JWT + MoveInLandlord module assignment)
    const moveInBase = landlordManagementBaseRoute + "/move_in";
    const moveInJwt = { preHandler: [authenticateJWT, requireMoveInAccess] };
    fastify.get(moveInBase + "/units", moveInJwt, get_move_in_units);
    fastify.get(moveInBase + "/available_units", moveInJwt, get_available_units);
    fastify.post(moveInBase + "/list_unit", { preHandler: [authenticateJWT, requireMoveInAccess, upload.any()] }, list_move_in_unit);
    fastify.put(moveInBase + "/list_unit/:unitId", { preHandler: [authenticateJWT, requireMoveInAccess, upload.any()] }, update_move_in_listing);
    fastify.get(moveInBase + "/bookings", moveInJwt, get_move_in_bookings);
    fastify.get(moveInBase + "/applications", moveInJwt, get_move_in_applications);
    fastify.put(moveInBase + "/applications/:applicationId", moveInJwt, respond_move_in_application);
    fastify.get(moveInBase + "/reservations", moveInJwt, get_move_in_reservations);
    fastify.put(moveInBase + "/reservations/:reservationId", moveInJwt, respond_move_in_reservation);
    fastify.put(moveInBase + "/deals/:dealId/convert", moveInJwt, convert_move_in_deal);
    fastify.get(moveInBase + "/commissions", moveInJwt, get_move_in_commissions);
    fastify.get(moveInBase + "/performance", moveInJwt, get_move_in_performance);
    // Viewing slots
    fastify.post(moveInBase + "/viewing/slots", moveInJwt, create_viewing_slot);
    fastify.get(moveInBase + "/viewing/slots", moveInJwt, get_viewing_slots);
    fastify.delete(moveInBase + "/viewing/slots/:slotId", moveInJwt, cancel_viewing_slot);
    fastify.get(moveInBase + "/viewing/bookings", moveInJwt, get_viewing_bookings);
    fastify.put(moveInBase + "/viewing/bookings/:bookingId", moveInJwt, respond_viewing_booking);
    // Messaging
    fastify.get(moveInBase + "/messaging/conversations", moveInJwt, landlord_get_conversations);
    fastify.get(moveInBase + "/messaging/conversations/:conversationId/messages", moveInJwt, landlord_get_messages);
    fastify.post(moveInBase + "/messaging/conversations/:conversationId/messages", moveInJwt, landlord_send_message);
}

module.exports = { registerRoutes };
