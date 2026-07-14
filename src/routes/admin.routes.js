const getListingsAdmin = require("../controllers/admin/get_pending_listings");
const approveListing = require("../controllers/admin/approve_listing");
const rejectListing = require("../controllers/admin/reject_listing");

const getAdminViewings = require("../controllers/admin/get_admin_viewings");
const getAdminReservations = require("../controllers/admin/get_admin_reservations");
const updateAdminReservation = require("../controllers/admin/update_admin_reservation");

const uploadDefaultLease = require("../controllers/admin/upload_default_lease");
const uploadUnitLease = require("../controllers/admin/upload_unit_lease");
const getPendingLeases = require("../controllers/admin/get_pending_leases");
const downloadSignedLease = require("../controllers/admin/download_signed_lease");
const approveLease = require("../controllers/admin/approve_lease");
const rejectLease = require("../controllers/admin/reject_lease");

const getPaymentSettings = require("../controllers/admin/get_payment_settings");
const makeUpdateFeeSetting = require("../controllers/admin/update_fee_setting");

const getFeaturedPackages = require("../controllers/admin/get_featured_packages");
const createFeaturedPackage = require("../controllers/admin/create_featured_package");
const updateFeaturedPackage = require("../controllers/admin/update_featured_package");
const deleteFeaturedPackage = require("../controllers/admin/delete_featured_package");

const setUnitCommission = require("../controllers/admin/set_unit_commission");
const getDisbursements = require("../controllers/admin/get_disbursements");
const disburse = require("../controllers/admin/disburse");

const getAdminDashboard = require("../controllers/dashboard/get_admin_dashboard");
const getPreferenceAnalytics = require("../controllers/admin/get_preference_analytics");

const getLandmarks = require("../controllers/admin/get_landmarks");
const createLandmark = require("../controllers/admin/create_landmark");
const updateLandmark = require("../controllers/admin/update_landmark");
const deleteLandmark = require("../controllers/admin/delete_landmark");

const getCustomers = require("../controllers/admin/get_customers");
const updateCustomer = require("../controllers/admin/update_customer");
const resetCustomerPassword = require("../controllers/admin/reset_customer_password");
const makeSetCustomerStatus = require("../controllers/admin/set_customer_status");

const getLandlords = require("../controllers/admin/get_landlords");
const updateLandlord = require("../controllers/admin/update_landlord");
const resetLandlordPassword = require("../controllers/admin/reset_landlord_password");
const assignLandlordModule = require("../controllers/admin/assign_landlord_module");
const revokeLandlordModule = require("../controllers/admin/revoke_landlord_module");

const getAuditLogs = require("../controllers/admin/get_audit_logs");
const sendReminder = require("../controllers/admin/send_reminder");

const { authenticate, requireRole } = require("../middlewares/authenticate");

async function adminRoutes(fastify) {
  const opts = { preHandler: [authenticate, requireRole("admin")] };

  fastify.get("/api/core/move_in/listings", opts, getListingsAdmin);
  fastify.post("/api/core/move_in/listings/approve", opts, approveListing);
  fastify.post("/api/core/move_in/listings/reject", opts, rejectListing);

  fastify.get("/api/core/move_in/viewings", opts, getAdminViewings);
  fastify.get("/api/core/move_in/reservations", opts, getAdminReservations);
  fastify.put("/api/core/move_in/reservations/:id", opts, updateAdminReservation);

  fastify.post("/api/move_in/admin/lease/default", opts, uploadDefaultLease);
  fastify.post("/api/move_in/admin/units/:unitId/lease", opts, uploadUnitLease);
  fastify.get("/api/move_in/admin/leases/pending-review", opts, getPendingLeases);
  fastify.get("/api/move_in/admin/leases/:leaseId/sign/:signedCopyId/download", opts, downloadSignedLease);
  fastify.put("/api/move_in/admin/lease/:leaseId/sign/:signedCopyId/approve", opts, approveLease);
  fastify.put("/api/move_in/admin/lease/:leaseId/sign/:signedCopyId/reject", opts, rejectLease);

  fastify.get("/api/move_in/admin/payment-settings", opts, getPaymentSettings);
  fastify.put("/api/move_in/admin/payment-settings/reservation-fee", opts, makeUpdateFeeSetting("reservation"));
  fastify.put("/api/move_in/admin/payment-settings/viewing-fee", opts, makeUpdateFeeSetting("viewing"));
  fastify.put("/api/move_in/admin/payment-settings/commission", opts, makeUpdateFeeSetting("commission"));

  fastify.get("/api/move_in/admin/featured-packages", opts, getFeaturedPackages);
  fastify.post("/api/move_in/admin/featured-packages", opts, createFeaturedPackage);
  fastify.put("/api/move_in/admin/featured-packages/:packageId", opts, updateFeaturedPackage);
  fastify.delete("/api/move_in/admin/featured-packages/:packageId", opts, deleteFeaturedPackage);

  fastify.put("/api/move_in/admin/units/:unitId/commission", opts, setUnitCommission);

  fastify.get("/api/move_in/admin/disbursements", opts, getDisbursements);
  fastify.post("/api/move_in/admin/disbursements/:id/disburse", opts, disburse);

  fastify.get("/api/core/move_in/dashboard", opts, getAdminDashboard);
  fastify.get("/api/core/move_in/preferences", opts, getPreferenceAnalytics);

  fastify.get("/api/core/move_in/landmarks", opts, getLandmarks);
  fastify.post("/api/core/move_in/landmarks", opts, createLandmark);
  fastify.put("/api/core/move_in/landmarks/:id", opts, updateLandmark);
  fastify.delete("/api/core/move_in/landmarks/:id", opts, deleteLandmark);

  fastify.get("/api/core/move_in/customers", opts, getCustomers);
  fastify.put("/api/core/move_in/customers/:id", opts, updateCustomer);
  fastify.put("/api/core/move_in/customers/reset_password/:id", opts, resetCustomerPassword);
  fastify.put("/api/core/move_in/customers/suspend/:id", opts, makeSetCustomerStatus("suspended"));
  fastify.put("/api/core/move_in/customers/activate/:id", opts, makeSetCustomerStatus("active"));

  fastify.get("/api/core/move_in/landlords", opts, getLandlords);
  fastify.put("/api/core/move_in/landlords/:id", opts, updateLandlord);
  fastify.put("/api/core/move_in/landlords/reset_password/:id", opts, resetLandlordPassword);
  fastify.post("/api/core/move_in/landlords/assign", opts, assignLandlordModule);
  fastify.put("/api/core/move_in/landlords/revoke/:id", opts, revokeLandlordModule);

  fastify.get("/api/core/move_in/audit_logs", opts, getAuditLogs);
  fastify.post("/api/core/move_in/reminders/send", opts, sendReminder);
}

module.exports = adminRoutes;
