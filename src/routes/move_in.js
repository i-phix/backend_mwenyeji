const authenticateJWT = require("../middlewares/jwt_authentication");
const require_movein_admin = require("../middlewares/require_movein_admin");
const gcs_upload = require("../middlewares/gcs_upload");
const register_customer = require("../controllers/move_in/auth/register_customer");
const login_user = require("../controllers/move_in/auth/login_user");
const verify_email = require("../controllers/move_in/auth/verify_email");
const forgot_password = require("../controllers/move_in/auth/forgot_password");
const verify_reset_otp = require("../controllers/move_in/auth/verify_reset_otp");
const reset_password = require("../controllers/move_in/auth/reset_password");
const save_preferences = require("../controllers/move_in/preferences/save_preferences");
const sync_preferences = require("../controllers/move_in/preferences/sync_preferences");
const get_listings = require("../controllers/move_in/listings/get_listings");
const get_listing_locations = require("../controllers/move_in/listings/get_listing_locations");
const get_place_suggestions = require("../controllers/move_in/places/get_place_suggestions");
const get_listing = require("../controllers/move_in/listings/get_listing");
const submit_application = require("../controllers/move_in/applications/submit_application");
const get_my_applications = require("../controllers/move_in/applications/get_my_applications");
const get_dashboard = require("../controllers/move_in/dashboard/get_dashboard");
const get_profile = require("../controllers/move_in/profile/get_profile");
const update_profile = require("../controllers/move_in/profile/update_profile");
const get_tenants = require("../controllers/move_in/tenants/get_tenants");
const get_checklists = require("../controllers/move_in/checklists/get_checklists");
const get_handovers = require("../controllers/move_in/handovers/get_handovers");
const get_slots = require("../controllers/move_in/viewing/get_slots");
const get_available_slots = require("../controllers/move_in/viewing/get_available_slots");
const book_slot = require("../controllers/move_in/viewing/book_slot");
const cancel_booking = require("../controllers/move_in/viewing/cancel_booking");
const get_my_bookings = require("../controllers/move_in/viewing/get_my_bookings");
const create_reservation = require("../controllers/move_in/reservations/create_reservation");
const get_my_reservations = require("../controllers/move_in/reservations/get_my_reservations");
const cancel_reservation = require("../controllers/move_in/reservations/cancel_reservation");
const get_notifications = require("../controllers/move_in/notifications/get_notifications");
const mark_read = require("../controllers/move_in/notifications/mark_read");
const mark_all_read = require("../controllers/move_in/notifications/mark_all_read");
const get_payment_history = require("../controllers/move_in/payments/get_history");
const get_conversations = require("../controllers/move_in/messaging/get_conversations");
const start_conversation = require("../controllers/move_in/messaging/start_conversation");
const get_messages = require("../controllers/move_in/messaging/get_messages");
const send_message = require("../controllers/move_in/messaging/send_message");

// Landlord auth
const landlord_register = require("../controllers/move_in/landlord/auth/register");
const landlord_login = require("../controllers/move_in/landlord/auth/login");
const landlord_handoff = require("../controllers/move_in/landlord/auth/handoff");
const landlord_verify_handoff = require("../controllers/move_in/landlord/auth/verify_handoff");

// Landlord image upload
const landlord_upload_images = require("../controllers/move_in/landlord/features/upload_unit_images");

// Admin controllers
const admin_get_pending_units = require("../controllers/move_in/admin/get_pending_units");
const admin_approve_unit = require("../controllers/move_in/admin/approve_unit");
const admin_get_landlords = require("../controllers/move_in/admin/get_landlords");
const admin_verify_landlord = require("../controllers/move_in/admin/verify_landlord");
const admin_get_applications = require("../controllers/move_in/admin/get_applications");
const admin_screen_application = require("../controllers/move_in/admin/screen_application");
const admin_get_reservations = require("../controllers/move_in/admin/get_reservations");
const admin_complete_onboarding = require("../controllers/move_in/admin/complete_onboarding");
const admin_get_deals = require("../controllers/move_in/admin/get_deals");
const admin_convert_deal = require("../controllers/move_in/admin/convert_deal");
const admin_get_commissions = require("../controllers/move_in/admin/get_commissions");
const admin_update_commission = require("../controllers/move_in/admin/update_commission");
const admin_get_landmarks = require("../controllers/move_in/admin/landmarks/get_landmarks");
const admin_create_landmark = require("../controllers/move_in/admin/landmarks/create_landmark");
const admin_update_landmark = require("../controllers/move_in/admin/landmarks/update_landmark");
const admin_delete_landmark = require("../controllers/move_in/admin/landmarks/delete_landmark");

// Landlord features
const landlord_dashboard = require("../controllers/move_in/landlord/features/dashboard");
const landlord_get_units = require("../controllers/move_in/landlord/features/get_units");
const landlord_create_unit = require("../controllers/move_in/landlord/features/create_unit");
const landlord_update_unit = require("../controllers/move_in/landlord/features/update_unit");
const landlord_get_apps = require("../controllers/move_in/landlord/features/get_applications");
const landlord_respond_app = require("../controllers/move_in/landlord/features/respond_application");
const landlord_get_slots = require("../controllers/move_in/landlord/features/get_viewing_slots");
const landlord_create_slot = require("../controllers/move_in/landlord/features/create_viewing_slot");
const landlord_cancel_slot = require("../controllers/move_in/landlord/features/cancel_viewing_slot");
const landlord_get_bookings = require("../controllers/move_in/landlord/features/get_bookings");
const landlord_respond_booking = require("../controllers/move_in/landlord/features/respond_booking");
const landlord_get_reservations = require("../controllers/move_in/landlord/features/get_reservations");
const landlord_respond_reservation = require("../controllers/move_in/landlord/features/respond_reservation");
const landlord_get_convs = require("../controllers/move_in/landlord/features/get_conversations");
const landlord_get_msgs = require("../controllers/move_in/landlord/features/get_messages");
const landlord_send_msg = require("../controllers/move_in/landlord/features/send_message");

async function registerRoutes(fastify) {
  const base = "/api/move_in";
  const jwt = { preHandler: authenticateJWT };

  // Auth
  fastify.post(base + "/auth/register", register_customer);
  fastify.post(base + "/auth/login", login_user);
  fastify.get(base + "/auth/verify_email/:token", verify_email);
  fastify.post(base + "/auth/forgot_password", forgot_password);
  fastify.post(base + "/auth/verify_reset_otp", verify_reset_otp);
  fastify.post(base + "/auth/reset_password", reset_password);

  // Preferences (no auth required — supports guests via guestId)
  fastify.post(base + "/preferences/save", save_preferences);
  fastify.post(base + "/preferences/sync", sync_preferences);

  // Listings
  fastify.get(base + "/places/suggestions", get_place_suggestions);
  fastify.get(base + "/listings", get_listings);
  fastify.get(base + "/listings/locations", get_listing_locations);
  fastify.get(base + "/listings/:id", get_listing);

  // Applications
  fastify.post(base + "/applications/submit_guest", submit_application);
  fastify.post(base + "/applications/submit", jwt, submit_application);
  fastify.get(base + "/applications/my", jwt, get_my_applications);

  // Dashboard
  fastify.get(base + "/dashboard", jwt, get_dashboard);

  // Tenant intake and move-in operations
  fastify.get(base + "/tenants", jwt, get_tenants);
  fastify.get(base + "/checklists", jwt, get_checklists);
  fastify.get(base + "/handovers", jwt, get_handovers);

  // Profile
  fastify.get(base + "/profile", jwt, get_profile);
  fastify.put(base + "/profile", jwt, update_profile);

  // Viewing slots & bookings
  fastify.get(base + "/viewing/slots", get_slots); // public (requires unitId)
  fastify.get(base + "/viewing/available", get_available_slots); // public — all available slots
  fastify.post(base + "/viewing/book_guest", book_slot);
  fastify.post(base + "/viewing/book", jwt, book_slot);
  fastify.put(
    base + "/viewing/bookings/cancel/:bookingId",
    jwt,
    cancel_booking,
  );
  fastify.get(base + "/viewing/bookings", jwt, get_my_bookings);

  // Reservations
  fastify.post(base + "/reservations/guest", create_reservation);
  fastify.post(base + "/reservations", jwt, create_reservation);
  fastify.get(base + "/reservations", jwt, get_my_reservations);
  fastify.put(
    base + "/reservations/cancel/:reservationId",
    jwt,
    cancel_reservation,
  );

  // Notifications
  fastify.get(base + "/notifications", jwt, get_notifications);
  fastify.put(base + "/notifications/read/:notificationId", jwt, mark_read);
  fastify.put(base + "/notifications/read_all", jwt, mark_all_read);

  // Payments
  fastify.get(base + "/payments", jwt, get_payment_history);

  // Messaging
  fastify.get(base + "/messaging/conversations", jwt, get_conversations);
  fastify.post(base + "/messaging/conversations", jwt, start_conversation);
  fastify.get(
    base + "/messaging/conversations/:conversationId/messages",
    jwt,
    get_messages,
  );
  fastify.post(
    base + "/messaging/conversations/:conversationId/messages",
    jwt,
    send_message,
  );

  // ── Landlord auth ─────────────────────────────────────────────────────────
  fastify.post(base + "/landlord/auth/register", landlord_register);
  fastify.post(base + "/landlord/auth/login", landlord_login);
  fastify.post(base + "/landlord/auth/handoff", jwt, landlord_handoff); // called by landlord_main
  fastify.post(base + "/landlord/auth/verify-handoff", landlord_verify_handoff); // called by move_in

  // ── Landlord features (all require Move-In landlord JWT) ──────────────────
  fastify.get(base + "/landlord/dashboard", jwt, landlord_dashboard);
  fastify.get(base + "/landlord/units", jwt, landlord_get_units);
  fastify.post(base + "/landlord/units", jwt, landlord_create_unit);
  fastify.put(base + "/landlord/units/:unitId", jwt, landlord_update_unit);
  fastify.get(base + "/landlord/applications", jwt, landlord_get_apps);
  fastify.put(
    base + "/landlord/applications/:applicationId",
    jwt,
    landlord_respond_app,
  );
  fastify.get(base + "/landlord/viewings/slots", jwt, landlord_get_slots);
  fastify.post(base + "/landlord/viewings/slots", jwt, landlord_create_slot);
  fastify.delete(
    base + "/landlord/viewings/slots/:slotId",
    jwt,
    landlord_cancel_slot,
  );
  fastify.get(base + "/landlord/viewings/bookings", jwt, landlord_get_bookings);
  fastify.put(
    base + "/landlord/viewings/bookings/:bookingId",
    jwt,
    landlord_respond_booking,
  );
  fastify.get(base + "/landlord/reservations", jwt, landlord_get_reservations);
  fastify.put(
    base + "/landlord/reservations/:reservationId",
    jwt,
    landlord_respond_reservation,
  );
  fastify.get(
    base + "/landlord/messaging/conversations",
    jwt,
    landlord_get_convs,
  );
  fastify.get(
    base + "/landlord/messaging/conversations/:conversationId/messages",
    jwt,
    landlord_get_msgs,
  );
  fastify.post(
    base + "/landlord/messaging/conversations/:conversationId/messages",
    jwt,
    landlord_send_msg,
  );

  // ── Landlord image upload ──────────────────────────────────────────────────
  fastify.post(
    base + "/landlord/units/:unitId/images",
    { preHandler: [authenticateJWT, gcs_upload.array("images", 10)] },
    landlord_upload_images,
  );

  // ── Admin routes (require a valid PayServe platform JWT — not tenant/landlord) ──
  const adminHandlers = { preHandler: [authenticateJWT, require_movein_admin] };
  fastify.get(
    base + "/admin/units/pending",
    adminHandlers,
    admin_get_pending_units,
  );
  fastify.put(
    base + "/admin/units/:unitId/approve",
    adminHandlers,
    admin_approve_unit,
  );
  fastify.get(base + "/admin/landlords", adminHandlers, admin_get_landlords);
  fastify.put(
    base + "/admin/landlords/:landlordId/verify",
    adminHandlers,
    admin_verify_landlord,
  );
  fastify.get(
    base + "/admin/applications",
    adminHandlers,
    admin_get_applications,
  );
  fastify.put(
    base + "/admin/applications/:appId/screen",
    adminHandlers,
    admin_screen_application,
  );
  fastify.get(
    base + "/admin/reservations",
    adminHandlers,
    admin_get_reservations,
  );
  fastify.put(
    base + "/admin/reservations/:reservationId/complete",
    adminHandlers,
    admin_complete_onboarding,
  );
  fastify.get(base + "/admin/deals", adminHandlers, admin_get_deals);
  fastify.put(
    base + "/admin/deals/:dealId/convert",
    adminHandlers,
    admin_convert_deal,
  );
  fastify.get(
    base + "/admin/commissions",
    adminHandlers,
    admin_get_commissions,
  );
  fastify.put(
    base + "/admin/commissions/:commissionId",
    adminHandlers,
    admin_update_commission,
  );

  // Landmarks
  fastify.get(base + "/admin/landmarks", adminHandlers, admin_get_landmarks);
  fastify.post(base + "/admin/landmarks", adminHandlers, admin_create_landmark);
  fastify.put(
    base + "/admin/landmarks/:landmarkId",
    adminHandlers,
    admin_update_landmark,
  );
  fastify.delete(
    base + "/admin/landmarks/:landmarkId",
    adminHandlers,
    admin_delete_landmark,
  );
}

module.exports = { registerRoutes };
