const authenticateJWT = require('../../../../middlewares/jwt_authentication');

// Power Meters Endpoints
const editPowerMeter = require('../controllers/power_meters/edit_power_meter');
const getAllPowerMeters = require('../controllers/power_meters/get_all_power_meters');
const getPowerMeter = require('../controllers/power_meters/get_power_meter');
const assignUnitToPowerMeter = require('../controllers/power_meters/meter_unit_assignment');
const getUnitMeterDetails = require('../controllers/power_meters/get_unit_meter');

// // Power Charges Endpoints
// const addPowerCharge = require('../controllers/power_charges/add_power_charge');
// const editPowerCharge = require('../controllers/power_charges/edit_power_charge');
// const getAllPowerCharges = require('../controllers/power_charges/get_all_power_charges');

// Power Commands Endpoints
const switchMeterOn = require('../controllers/commands/switch_on_meter');
const switchMeterOff = require('../controllers/commands/switch_off_meter');
const get_meetr_logs = require('../controllers/commands/get_meter_logs');

// Customer Account
const add_customer_account = require('../controllers/customer_management/add_customer_account');
const activate_customer_account = require('../controllers/customer_management/activate_customer_account');
const deactivate_customer_account = require('../controllers/customer_management/deactivate_customer_account');
const edit_customer_account = require('../controllers/customer_management/edit_customer_account');
const get_customer_account = require('../controllers/customer_management/get_single_customer_account');
const get_facility_customer_accounts = require('../controllers/customer_management/get_facility_customer_accounts');
const get_meter_customer_accounts = require('../controllers/customer_management/get_meter_customer_account');
const get_customer_credits = require('../controllers/biling/get_customer_credits');
const get_customer_debits = require('../controllers/biling/get_customer_debits');
const get_customer_account_balance = require('../controllers/biling/get_customer_balances');
const add_credit_to_customer = require('../controllers/biling/add_credit_to_customer');
const get_account_by_id = require('../controllers/customer_management/get_account_by_id_and_account');

// Meter History Data
const get_meter_daily_consumption = require('../controllers/history_data/get_meter_daily_readings');
const get_meter_single_day_consumption = require('../controllers/history_data/get_single_day_meter_readings');
const get_meter_monthly_consumption = require('../controllers/history_data/get_monthly_meter_reading');
const get_meter_monthly_graphs = require('../controllers/history_data/get_facility_meters_graph');
const getFailedPowerPayments = require('../controllers/power_meters/get_failed_payments')
async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

    // Base Routes
    const powerMetersBaseRoute = '/api/customer_obsession/utility_management/power_meter_management/controllers/power_meters';
    const powerSwitchCommandsBaseRoute = '/api/customer_obsession/utility_management/power_meter_management/controllers/commands';
    const powerCustomerAccountBaseRoute = '/api/customer_obsession/utility_management/power_meter_management/controllers/customer_management';
    const powerHistoryDataBaseRoute = '/api/customer_obsession/utility_management/power_meter_management/controllers/history_data';

    // Power Meters Routes
    fastify.get(`${powerMetersBaseRoute}/get_all/:facilityId`, jwt, getAllPowerMeters);
    fastify.get(`/payment-processing/failed`, getFailedPowerPayments);

    fastify.get(`${powerMetersBaseRoute}/get_meter/:meterId`, jwt, getPowerMeter);
    fastify.get(`${powerMetersBaseRoute}/get_unit_meter/:unitId`, jwt, getUnitMeterDetails);
    fastify.put(`${powerMetersBaseRoute}/edit_meter/:meterId`, jwt, editPowerMeter);
    fastify.put(`${powerMetersBaseRoute}/assign_unit/:meterId`, jwt, assignUnitToPowerMeter);

    // // Power Charges Routes
    // fastify.post(`${powerChargesBaseRoute}/add_charge`, jwt, addPowerCharge);
    // fastify.put(`${powerChargesBaseRoute}/edit_charge/:chargeId`, jwt, editPowerCharge);
    // fastify.get(`${powerChargesBaseRoute}/get_all/:facilityId`, jwt, getAllPowerCharges);

    // Power Switch Commands Routes
    fastify.post(`${powerSwitchCommandsBaseRoute}/switch_on/:meterId`, jwt, switchMeterOn);
    fastify.post(`${powerSwitchCommandsBaseRoute}/switch_off/:meterId`, jwt, switchMeterOff);
    fastify.get(`${powerSwitchCommandsBaseRoute}/get_meter_logs/:meterId`, jwt, get_meetr_logs);

    // ======= Customer Accounts Routes =======
    fastify.post(`${powerCustomerAccountBaseRoute}/add_customer_account`, jwt, add_customer_account);
    fastify.put(`${powerCustomerAccountBaseRoute}/activate_customer_account/:accountId`, jwt, activate_customer_account);
    fastify.put(`${powerCustomerAccountBaseRoute}/deactivate_customer_account/:accountId`, jwt, deactivate_customer_account);
    fastify.put(`${powerCustomerAccountBaseRoute}/edit_customer_account/:accountId`, jwt, edit_customer_account);
    fastify.get(`${powerCustomerAccountBaseRoute}/get_customer_account/:accountId`, jwt, get_customer_account);
    fastify.get(`${powerCustomerAccountBaseRoute}/get_facility_customer_accounts/:facilityId`, jwt, get_facility_customer_accounts);
    fastify.get(`${powerCustomerAccountBaseRoute}/meter_customer_accounts/:meterId`, jwt, get_meter_customer_accounts);
    fastify.get(`${powerCustomerAccountBaseRoute}/get_customer_credits/:accountId`, jwt, get_customer_credits);
    fastify.get(`${powerCustomerAccountBaseRoute}/get_customer_debits/:accountId`, jwt, get_customer_debits);
    fastify.get(`${powerCustomerAccountBaseRoute}/customer_account/:customerId/:accountNumber`, jwt, get_account_by_id);
    fastify.get(`${powerCustomerAccountBaseRoute}/get_customer_account_balance/:accountId`, jwt, get_customer_account_balance);
    fastify.post(`${powerCustomerAccountBaseRoute}/add_credit_to_customer/:accountId`, jwt, add_credit_to_customer);

    // ======= Meter History Data Routes =======
    fastify.get(`${powerHistoryDataBaseRoute}/power_usage_monthly_graph/:facilityId`, jwt, get_meter_monthly_graphs);
    fastify.get(`${powerHistoryDataBaseRoute}/meter_daily_consumption/:meterId`, jwt, get_meter_daily_consumption);
    fastify.get(`${powerHistoryDataBaseRoute}/meter_monthly_consumption/:meterId`, jwt, get_meter_monthly_consumption);
    fastify.get(`${powerHistoryDataBaseRoute}/meter_single_day_consumption/:meterId`, jwt, get_meter_single_day_consumption);


}

module.exports = { registerRoutes };