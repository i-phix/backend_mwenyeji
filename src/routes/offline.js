
const get_invoice_by_id = require("../controllers/app/levy_management/invoices/get_invoice_by_id");

async function registerRoutes(fastify) {

    const levyManagementBaseRoute = "/api/app/levy_management";


    fastify.get(levyManagementBaseRoute + "/get_invoice_by_id/:facilityId/:invoiceId", get_invoice_by_id);

}

module.exports = { registerRoutes };