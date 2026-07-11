const authenticateJWT = require('../../../../middlewares/jwt_authentication');

// Customer Bands Endpoints
const addCustomerBand = require('../controllers/customer_band/add_customer_band');
const editCustomerBand = require('../controllers/customer_band/edit_customer_band');
const getAllCustomerBands = require('../controllers/customer_band/get_all_customer_bands');
const getCustomerBand = require('../controllers/customer_band/get_customer_band');
const deleteCustomerBand = require('../controllers/customer_band/delete_customer_band');

// Manufacturer Endpoints
const addManufacturer = require('../controllers/manufacturers/add_manufacturer');
const editManufacturer = require('../controllers/manufacturers/edit_manufacturer');
const getAllManufacturers = require('../controllers/manufacturers/get_all_manufacturers');
const getManufacturer = require('../controllers/manufacturers/get_manufacturer');
const deleteManufacturer = require('../controllers/manufacturers/delete_manufacturer');

// Power Meters Endpoints
const addPowerMeter = require('../controllers/power_meters/add_power_meter');
const editPowerMeter = require('../controllers/power_meters/edit_power_meter');
const getAllPowerMeters = require('../controllers/power_meters/get_all_power_meters');
const getPowerMeter = require('../controllers/power_meters/get_power_meter');
const importPowerMeters = require('../controllers/power_meters/bulkImportPowerMeters');

// Meters Communication Protocol Endpoints
const addPowerMeterProtocol = require('../controllers/protocols/add_protocol');
const deletePowerMeterProtocol = require('../controllers/protocols/delete_protocol');
const getAllPowerMeterProtocols = require('../controllers/protocols/get_all_protocols');

// Meters Communication Gateways Endpoints
const addPowerMeterGateway = require('../controllers/gateways/add_gateway');
const deletePowerMeterGateway  = require('../controllers/gateways/delete_gateway');
const getAllPowerMeterGateways = require('../controllers/gateways/get_all_gateways');

async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

    // Base Routes
    const customerBandBaseRoute = '/api/core/power_meter_management/controllers/customer_band';
    const manufacturerBaseRoute = '/api/core/power_meter_management/controllers/manufacturers';
    const powerMetersBaseRoute = '/api/core/power_meter_management/controllers/power_meters';
    const powerMeterProtocolBaseRoute = '/api/core/power_meter_management/controllers/protocols';
    const powerMeterGatewayBaseRoute = '/api/core/power_meter_management/controllers/gateways';

    // Customer Band Routes
    fastify.post(`${customerBandBaseRoute}/add_customerband`, jwt, addCustomerBand);
    fastify.get(`${customerBandBaseRoute}/get_all`, jwt, getAllCustomerBands);
    fastify.get(`${customerBandBaseRoute}/get_customerband/:bandId`, jwt, getCustomerBand);
    fastify.put(`${customerBandBaseRoute}/edit_customerband/:bandId`, jwt, editCustomerBand);
    fastify.delete(`${customerBandBaseRoute}/delete_customerband/:bandId`, jwt, deleteCustomerBand);

    // Manufacturers Routes
    fastify.post(`${manufacturerBaseRoute}/add_manufacturer`, jwt, addManufacturer);
    fastify.get(`${manufacturerBaseRoute}/get_all`, jwt, getAllManufacturers);
    fastify.get(`${manufacturerBaseRoute}/get_manufacturer/:manufacturerId`, jwt, getManufacturer);
    fastify.put(`${manufacturerBaseRoute}/edit_manufacturer/:manufacturerId`, jwt, editManufacturer);
    fastify.delete(`${manufacturerBaseRoute}/delete_manufacturer/:manufacturerId`, jwt, deleteManufacturer);

    // Power Meters Routes
    fastify.post(`${powerMetersBaseRoute}/add_meter`, jwt, addPowerMeter);
    fastify.get(`${powerMetersBaseRoute}/get_all`, jwt, getAllPowerMeters);
    fastify.get(`${powerMetersBaseRoute}/get_meter/:meterId`, jwt, getPowerMeter);
    fastify.put(`${powerMetersBaseRoute}/edit_meter/:meterId`, jwt, editPowerMeter);
    fastify.post(`${powerMetersBaseRoute}/bulk_import`, importPowerMeters);

    // Power Meters Protocol Routes
    fastify.post(`${powerMeterProtocolBaseRoute}/add_protocol`, jwt, addPowerMeterProtocol);
    fastify.get(`${powerMeterProtocolBaseRoute}/get_all_protocols`, jwt, getAllPowerMeterProtocols);
    fastify.delete(`${powerMeterProtocolBaseRoute}/delete_protocol/:id`, jwt, deletePowerMeterProtocol);

      // Power Meters Gateways Routes
    fastify.post(`${powerMeterGatewayBaseRoute}/add_gateway`, jwt, addPowerMeterGateway);
    fastify.get(`${powerMeterGatewayBaseRoute}/get_all_gateways`, jwt, getAllPowerMeterGateways);
    fastify.delete(`${powerMeterGatewayBaseRoute}/delete_gateway/:id`, jwt, deletePowerMeterGateway);
}

module.exports = { registerRoutes };