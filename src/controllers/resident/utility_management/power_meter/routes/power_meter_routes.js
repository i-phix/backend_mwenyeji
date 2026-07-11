const authenticateJWT = require('../../../../../middlewares/jwt_authentication');

// Power Charges Endpoints
const get_customer_meter = require('../controllers/get_customer_meter');
const get_meter_details = require('../controllers/get_meter_details');
const get_meter_history_data = require('../controllers/get_meter_history_data');


async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

     // Base Routes
    const powerMetersBaseRoute = '/api/resident/utility_management/power_meters';

    // Power Routes
    fastify.get(`${powerMetersBaseRoute}/get_customer_meter/:customerId`, jwt, get_customer_meter);
    fastify.get(`${powerMetersBaseRoute}/get_meter_details/:meterId`, jwt, get_meter_details);
    fastify.get(`${powerMetersBaseRoute}/get_meter_history_data/:meterId`, jwt, get_meter_history_data);

}

module.exports = { registerRoutes };