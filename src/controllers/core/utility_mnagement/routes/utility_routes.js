const authenticateJWT = require('../../../../middlewares/jwt_authentication');

// Concentrator Endpoints
const addConcentrator = require('../controllers/concentrators/add_concentrator');
const editConcentrator = require('../controllers/concentrators/edit_concentrator');
const deleteConcentrator = require('../controllers/concentrators/delete_concentrator');
const getAllConcentrators = require('../controllers/concentrators/get_all_concenrators');
const getConcentrator = require('../controllers/concentrators/get_concentrator');
const updateConcentratorStatus = require('../controllers/concentrators/update_concentrator_status');

// Water Meter Endpoints
const addWaterMeter = require('../controllers/water_meters/add_water_meter');
const editWaterMeter = require('../controllers/water_meters/edit_water_meter');
const deleteWaterMeter = require('../controllers/water_meters/delete_water_meter');
const getWaterMeter = require('../controllers/water_meters/get_water_meter');
const getWaterMeters = require('../controllers/water_meters/get_all_water_meters');
const getMeterCounts = require('../controllers/water_meters/get_meter_counts');
const updateMeterStatus = require('../controllers/water_meters/update_meter_status');
const uploadMeters = require('../controllers/water_meters/import_water_meters');

// Water Meter Size Endpoints
const addWaterMeterSize = require('../controllers/meter_sizes/add_meter_size');
const deleteWaterMeterSize = require('../controllers/meter_sizes/delete_meter_size');
const getWaterMetersSizes = require('../controllers/meter_sizes/get_all_meter_sizes');

// Water Meter Size Endpoints
const addMeterCommunicationProtocol = require('../controllers/communication_protocols/add_meter_communication_protocol');
const deleteMeterCommunicationProtocol = require('../controllers/communication_protocols/delete_meter_communication_protocol');
const getMeterCommunicationProtocols = require('../controllers/communication_protocols/get_all_meter_communication_protocol');

// Water Meter Manufacturer Endpoints
const addMeterManufacturer = require('../controllers/meter_manufacturers/add_meter_manufacturer');
const editMeterManufacturer = require('../controllers/meter_manufacturers/edit_meter_manufacturer');
const deleteMeterManufacturer = require('../controllers/meter_manufacturers/delete_meter_manufacturer');
const getMeterManufacturers = require('../controllers/meter_manufacturers/get_all_meter_manufacturers');

// Water Meter IOT Cards Endpoints
const addMeterIotCard = require('../controllers/meter_iot_cards/add_meter_iot_card');
const editMeterIotCard = require('../controllers/meter_iot_cards/edit_meter_iot_card');
const deleteMeterIotCard = require('../controllers/meter_iot_cards/delete_meter_iot_card');
const getMeterIotCards = require('../controllers/meter_iot_cards/get_all_iot_cards');

// Delivery Endpoints
const addDelivery = require('../controllers/water_meters_delivery/add_meters_delivery');
const editDelivery = require('../controllers/water_meters_delivery/update_meters_delivery');
const deleteDelivery = require('../controllers/water_meters_delivery/delete_meters_delivery');
const cancelDelivery = require('../controllers/water_meters_delivery/cancel_meters_delivery');
const getAllDeliveries = require('../controllers/water_meters_delivery/get_all_meters_delivery');
const getMeterDelivery = require('../controllers/water_meters_delivery/get_meter_delivery');

// File Upload and Fetch Endpoints
const upload = require('../../../../middlewares/file_upload');
const uploadDeliveryDocument = require('../controllers/upload/delivery_upload');

async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

    // Base Routes
    const concentratorBaseRoute = '/api/core/concentrators';
    const waterMeterBaseRoute = '/api/core/water-meters';
    const waterMeterSizeBaseRoute = '/api/core/water-meters-sizes';
    const waterMeterCommunicatonProtocolsRoute = '/api/core/water-meter-communcation-protocol';
    const waterMeterManufacturerBaseRoute = '/api/core/water-meter-manufacturer';
    const waterMeterIotCardsBaseRoute = '/api/core/water-meter-iot-cards';
    const waterMeterDeliveryBaseRoute = '/api/core/water-meters-delivery';
    const uploadsBaseRoute = '/api/core/uploads';

    // Concentrators Routes
    fastify.post(`${concentratorBaseRoute}`, jwt, addConcentrator);
    fastify.get(`${concentratorBaseRoute}`, jwt, getAllConcentrators);
    fastify.get(`${concentratorBaseRoute}/:concentratorId`, jwt, getConcentrator);
    fastify.put(`${concentratorBaseRoute}/:concentratorId`, jwt, editConcentrator);
    fastify.delete(`${concentratorBaseRoute}/:concentratorId`, jwt, deleteConcentrator);
    fastify.put(`${concentratorBaseRoute}/update_status/:conid`, updateConcentratorStatus);

    // Water Meters Routes
    fastify.post(`${waterMeterBaseRoute}`, jwt, addWaterMeter);
    fastify.get(`${waterMeterBaseRoute}`, jwt, getWaterMeters);
    fastify.get(`${waterMeterBaseRoute}/count/:facilityId`, jwt, getMeterCounts);
    fastify.get(`${waterMeterBaseRoute}/:meterId`, jwt, getWaterMeter);
    fastify.put(`${waterMeterBaseRoute}/:meterId`, jwt, editWaterMeter);
    fastify.put(`${waterMeterBaseRoute}/:meterId/status`, jwt, updateMeterStatus);
    fastify.delete(`${waterMeterBaseRoute}/:meterId`, jwt, deleteWaterMeter);
    fastify.post(`${waterMeterBaseRoute}/:import_meters`, jwt, uploadMeters);
    //Add Meters 
    fastify.post(
        `${waterMeterBaseRoute}/import`,
        {
            preHandler: [authenticateJWT, upload.single('file')]
        },
        uploadMeters
    );
    // geting meters without jwt for the meter microservice
    fastify.get(`${waterMeterBaseRoute}/service/`, getWaterMeters);

    // Water Meters Size Routes
    fastify.post(`${waterMeterSizeBaseRoute}`, jwt, addWaterMeterSize);
    fastify.get(`${waterMeterSizeBaseRoute}`, jwt, getWaterMetersSizes);
    fastify.delete(`${waterMeterSizeBaseRoute}/:code`, jwt, deleteWaterMeterSize);

    // Water Meters Communication Protocols Routes
    fastify.post(`${waterMeterCommunicatonProtocolsRoute}`, jwt, addMeterCommunicationProtocol);
    fastify.get(`${waterMeterCommunicatonProtocolsRoute}`, jwt, getMeterCommunicationProtocols);
    fastify.delete(`${waterMeterCommunicatonProtocolsRoute}/:name`, jwt, deleteMeterCommunicationProtocol);

    // Water Meters Manufacturerers Routes
    fastify.post(`${waterMeterManufacturerBaseRoute}`, jwt, addMeterManufacturer);
    fastify.get(`${waterMeterManufacturerBaseRoute}`, jwt, getMeterManufacturers);
    fastify.put(`${waterMeterManufacturerBaseRoute}/:id`, jwt, editMeterManufacturer);
    fastify.delete(`${waterMeterManufacturerBaseRoute}/:id`, jwt, deleteMeterManufacturer);

    // Water Meters IOT Cards Routes
    fastify.post(`${waterMeterIotCardsBaseRoute}`, jwt, addMeterIotCard);
    fastify.get(`${waterMeterIotCardsBaseRoute}`, jwt, getMeterIotCards);
    fastify.put(`${waterMeterIotCardsBaseRoute}/:id`, jwt, editMeterIotCard);
    fastify.delete(`${waterMeterIotCardsBaseRoute}/:id`, jwt, deleteMeterIotCard);

    // Water Meters Delivery Routes
    fastify.post(`${waterMeterDeliveryBaseRoute}`, jwt, addDelivery);
    fastify.get(`${waterMeterDeliveryBaseRoute}`, jwt, getAllDeliveries);
    fastify.put(`${waterMeterDeliveryBaseRoute}/cancel/:deliveryId`, jwt, cancelDelivery);
    fastify.put(`${waterMeterDeliveryBaseRoute}/:deliveryId`, jwt, editDelivery);
    fastify.delete(`${waterMeterDeliveryBaseRoute}/:deliveryId`, jwt, deleteDelivery);
    fastify.get(`${waterMeterDeliveryBaseRoute}/details/:deliveryId`, jwt, getMeterDelivery);

    // Upload Delivery Notes
    fastify.post(
        `${uploadsBaseRoute}/upload-document/:deliveryId`,
        {
            preHandler: [
                authenticateJWT,
                upload.fields([{ name: 'signedDocument', maxCount: 1 }])
            ]
        },
        uploadDeliveryDocument
    );


}

module.exports = { registerRoutes };