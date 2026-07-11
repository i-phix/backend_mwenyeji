const authenticateJWT = require('../../../../middlewares/jwt_authentication');

const getInvoice = require('./get_single_invoice');
const getCustomerInvoice = require('./get_resident_invoice');
const getCustomerInvoices = require('./get_resident_water_invoices');

// Water Invoices Endpoints
async function registerRoutes(fastify) {
  const jwt = { preHandler: authenticateJWT };

  // Base Routes
  const waterInvoicesBaseRoute = '/water';
  const residentInvoicesBaseRoute = '/api/resident/utility_management/water_meter';

  // WaterInvocies Routes
  fastify.get(`${waterInvoicesBaseRoute}/:invoiceId`, getInvoice);
  fastify.get(`${residentInvoicesBaseRoute}/invocie/:customerId/:invoiceId`, jwt, getCustomerInvoice);
  fastify.get(`${residentInvoicesBaseRoute}/invoices/:customerId`,jwt,  getCustomerInvoices);

}

module.exports = { registerRoutes };