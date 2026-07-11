const authenticateJWT = require("../middlewares/jwt_authentication");


// Service Charge
const add_service_charge_invoice = require("../controllers/accounts/controllers/service_charge/add_service_charge_invoice")
const add_service_charge_payment = require("../controllers/accounts/controllers/service_charge/add_service_charge_payment")
const get_service_charge_invoice = require("../controllers/accounts/controllers/service_charge/get_service_charge_invocie")
const get_service_charge_payment = require("../controllers/accounts/controllers/service_charge/get_service_charge_payment")
const {
    edit_service_charge_invoice,
    get_service_charge_invoice_by_id,
    get_service_charge_payment_by_id,
    edit_service_charge_payment,
} = require("../controllers/accounts/controllers/service_charge/reconcile");


// Vas Invoice Quickbooks
const add_vas_invoice = require("../controllers/accounts/controllers/vas/add_vas_invoice")
const get_vas_invoice = require("../controllers/accounts/controllers/vas/get_vas_invoice")

// Vas Payment Quickbooks
const add_vas_payment = require("../controllers/accounts/controllers/vas/add_vas_payment")
const get_vas_payment = require("../controllers/accounts/controllers/vas/get_vas_payment")

const {
    get_vas_invoice_by_id,
    get_vas_payment_by_id,
    edit_vas_invoice,
    edit_vas_payment 
} = require("../controllers/accounts/controllers/vas/reconcile")


async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

    const accountsBaseRoute = "/api/accounts";


    // Service Charge Invoice Routes
    fastify.post(accountsBaseRoute + "/service_charge/add_service_charge_invoice/:facilityId", add_service_charge_invoice);
    fastify.get(accountsBaseRoute + "/service_charge/get_service_charge_invoice/:facilityId", get_service_charge_invoice);
    fastify.put(accountsBaseRoute + "/service_charge/edit_service_charge_invoice/:_id/facilityId", edit_service_charge_invoice);
    fastify.get(accountsBaseRoute + "/service_charge/get_service_charge_invoice_by_id/:_id/:facilityId", get_service_charge_invoice_by_id);

    // Service Charge Payment Routes
    fastify.post(accountsBaseRoute + "/service_charge/add_service_charge_payment/:facilityId", add_service_charge_payment);
    fastify.get(accountsBaseRoute + "/service_charge/get_service_charge_payment/:facilityId", get_service_charge_payment);
    fastify.put(accountsBaseRoute + "/service_charge/edit_service_charge_payment/:_id/:facilityId", edit_service_charge_payment);
    fastify.get(accountsBaseRoute + "/service_charge/get_service_charge_payment_by_id/:_id/:facilityId", get_service_charge_payment_by_id);

    // Vas Invoice Routes
    fastify.post(accountsBaseRoute + "/vas/add_vas_invoice/:facilityId", add_vas_invoice);
    fastify.get(accountsBaseRoute + "/vas/get_vas_invoice/:facilityId", get_vas_invoice);
    fastify.get(accountsBaseRoute + "/vas/get_vas_invoice_by_id/:_id/:facilityId", get_vas_invoice_by_id);
    fastify.put(accountsBaseRoute + "/vas/edit_vas_invoice/:_id/:facilityId", edit_vas_invoice);


    // Vas Payment Routes
    fastify.post(accountsBaseRoute + "/vas/add_vas_payment/:facilityId", add_vas_payment);
    fastify.get(accountsBaseRoute + "/vas/get_vas_payment/:facilityId", get_vas_payment);
    fastify.get(accountsBaseRoute + "/vas/get_vas_payment_by_id/:_id/:facilityId", get_vas_payment_by_id);
    fastify.put(accountsBaseRoute + "/vas/edit_vas_payment/:_id/:facilityId", edit_vas_payment);


}

module.exports = { registerRoutes };