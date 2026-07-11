const authenticateJWT = require('../../../../middlewares/jwt_authentication');
const upload = require('../../../../middlewares/file_upload');

//Smart Water Meter Endpoints
const editWaterMeter = require('../smart_meters/edit_water_meter');
const getWaterMeter = require('../smart_meters/get_water_meter');
const getWaterMeters = require('../smart_meters/get_all_water_meters');
const getMetersStats = require('../smart_meters/get_meters_stats');
const getMeterReadings = require('../smart_meters/get_single_day_meter_reading_history');
const getDailyMeterReadings = require('../smart_meters/get_daily_meter_reading_history');
const getMonthlyMeterReadings = require('../smart_meters/get_meter_monthly_history');
const getMonthlyMeterGraphs = require('../smart_meters/get_meter_graph');
const getMonthlyMetersConsumption = require('../smart_meters/get_meter_monthly_consumption');
const getBulkMetersConsumption = require('../smart_meters/get_bulk_meters_meters_consumption');
const getDailyMetersConsumption = require('../smart_meters/get_daily_consumption');
const openMeter = require('../smart_meters/open_water_meter');
const closeMeter = require('../smart_meters/close_water_meter');
const getMeterRealtimeData = require('../smart_meters/read_meter_data');
const getMeterLogs = require('../smart_meters/get_meter_communication_logs')
const updateMeterEnforcement = require('../smart_meters/update_meter_enforcement');
const get_facility_monthly_consumption = require('../smart_meters/get_facility_monthly_consumption');

// Analog Water Meter Endpoints
const addAnalogMeter = require('../analog_meters/add_analog_meter');
const editAnalogMeter = require('../analog_meters/edit_analog_meter');
const deleteAnalogMeter = require('../analog_meters/delete_analog_meter');
const getAnalogMeters = require('../analog_meters/get_all_analog_meters');
const getAnalogMeter = require('../analog_meters/get_analog_meter');
const getCustomerMeters = require('../analog_meters/get_customer_meter');
const getUnitAnalogMeter = require('../analog_meters/get_unit_meter_details');
const getAnalogMeterCounts = require('../analog_meters/get_analog_counts');
const getMonthlyConsumption = require('../analog_meters/getMonthlyMeterReadings');
const getDailyReadings = require('../analog_meters/getDailyMeterReadings');
const getMeterDetailsWithConsumption = require('../analog_meters/get_monthly_details');
const updateReadings = require('../analog_meters/update_meter_readings');

//Analog meters billing Endpoints 
const importAnalogMeterReadings = require('../meters_billing/add_bulk_readings');
const getAnalogBillingHistory = require('../meters_billing/get_analog_history');
const updateBillingStatus = require('../meters_billing/update_review_status');
const generateMeterBill = require('../meters_billing/generate_meter_bill');

// Customer Account Endpoints
const addCustomerAccount = require('../customer_account/add_customer_account');
const editCustomerAccount = require('../customer_account/edit_customer_account');
const deactivateCustomerAccount = require('../customer_account/deactivate_customer_account');
const activateCustomerAccount = require('../customer_account/activate_customer_account');
const getCustomerAccount = require('../customer_account/get_customer_account');
const getSingleCustomerAccount = require('../customer_account/get_single_customer');
const getAllCustomerAccount = require('../customer_account/get_all_customer_accounts');
const getMeterByAcc = require('../customer_account/get_account_by_number');
const getAccBalance = require('../customer_account/get_account_balance');
const getAccCredits = require('../customer_account/get_account_credits');
const getAccDebits = require('../customer_account/get_account_debits');
const addAccCredit = require('../customer_account/add_credit');
const getCustomerTransactions = require('../customer_account/get_customer_transactions');
const importCustomerAccounts = require('../customer_account/add_bulk_customer_accounts');
const getFacilityFinancialSummary = require('../customer_account/getFacilityFinancialSummary');
const getCustomerConsumptions = require('../customer_account/getMonthlyConsumption');
const { resendOnboardingController } = require('../customer_account/resend_onboarding');

// Water Invoices Endpoints
const getInvoices = require('../invoices/get_all_invoices');
const getInvoice = require('../invoices/get_invoice');
const getAccountInvoices = require('../invoices/get_account_invoice');
const getCustomerInvoices = require('../invoices/get_customer_invoice');
const getCustomerMeterInvoices = require('../invoices/getMeterCustomerInvoices');
const filterInvoices = require('../invoices/filter_facility_invoices');

// Common Area Electricity Reading Endpoints
const addCommonAreaElectricityReading = require('../common_area_utilities/common_area_electricity/add_electricity_reading');
const getCommonAreaElectricityReadingById = require('../common_area_utilities/common_area_electricity/get_electricity_reading');
const getCommonAreaElectricityReadings = require('../common_area_utilities/common_area_electricity/get_all_electricity_readings');
const editCommonAreaElectricityReading = require('../common_area_utilities/common_area_electricity/edit_electricity_reading');

// Common Area Water Reading Endpoints
const addCommonAreaWaterReading = require('../common_area_utilities/common_area_water/add_common_water_reading');
const getCommonAreaWaterReadingById = require('../common_area_utilities/common_area_water/get_common_water_reading');
const getCommonAreaWaterReadings = require('../common_area_utilities/common_area_water/get_all_common_water_readings');
const editCommonAreaWaterReading = require('../common_area_utilities/common_area_water/edit_common_water_reading');

// Common Area Generator Reading Endpoints
const addCommonAreaGeneratorReading = require('../common_area_utilities/common_area_generator/add_common_generator_reading');
const getCommonAreaGeneratorReadingById = require('../common_area_utilities/common_area_generator/get_common_generator_reading');
const getCommonAreaGeneratorReadings = require('../common_area_utilities/common_area_generator/get_all_common_generator_readings');
const editCommonAreaGeneratorReading = require('../common_area_utilities/common_area_generator/edit_common_generator_reading');

// Reports Endpoints
const consumptionReports = require('../reports/getConsumptionReport');
const paymentReports = require('../reports/getPaymentReport');
const getBillingSummaryReports = require('../reports/getBillingSummaryReport');
const getArrearsAgingReport = require('../reports/getArrearsAgingReport');


async function registerRoutes(fastify) {
  const jwt = { preHandler: authenticateJWT };

  // Base Routes
  const waterMeterBaseRoute = '/api/app/water-meters';
  const analogMeterBaseRoute = '/api/app/analog-meters';
  const customerAccountBaseRoute = '/api/app/customer-account';
  const waterInvoicesBaseRoute = '/api/app/water-invoices';
  const commonAreaElectricityBaseRoute = '/api/app/common-area/electricity';
  const commonAreaWaterBaseRoute = '/api/app/common-area/water';
  const commonAreaGeneratorBaseRoute = '/api/app/common-area/generator';
  const reportsBaseRoute = '/api/app/utility_management/reports';


  //Smart Water Meters Routes
  fastify.get(`${waterMeterBaseRoute}/:facilityId`, jwt, getWaterMeters);
  fastify.get(`${waterMeterBaseRoute}/details/:meterId`, jwt, getWaterMeter);
  fastify.get(`${waterMeterBaseRoute}/readings/:meterId`, jwt, getMeterReadings);
  fastify.get(`${waterMeterBaseRoute}/daily_readings/:meterId`, jwt, getDailyMeterReadings);
  fastify.get(`${waterMeterBaseRoute}/monthly_readings/:meterId`, jwt, getMonthlyMeterReadings);
  fastify.get(`${waterMeterBaseRoute}/monthly_meter_graphs/:facilityId`, jwt, getMonthlyMeterGraphs);
  fastify.get(`${waterMeterBaseRoute}/monthly_meter_consumption/:facilityId`, jwt, getMonthlyMetersConsumption);
  fastify.get(`${waterMeterBaseRoute}/bulk_meters_consumption/:facilityId`, jwt, getBulkMetersConsumption);
  fastify.get(`${waterMeterBaseRoute}/daily_meter_consumption/:facilityId`, jwt, getDailyMetersConsumption);
  fastify.post(`${waterMeterBaseRoute}/open_meter/:meterId`, jwt, openMeter);
  fastify.post(`${waterMeterBaseRoute}/close_meter/:meterId`, jwt, closeMeter);
  fastify.post(`${waterMeterBaseRoute}/get_realtime_data/:meterId`, jwt, getMeterRealtimeData);
  fastify.get(`${waterMeterBaseRoute}/get_meter_logs/:meterId`, jwt, getMeterLogs);
  fastify.put(`${waterMeterBaseRoute}/:meterId`, jwt, editWaterMeter);
  fastify.get(`${waterMeterBaseRoute}/stats/:facilityId`, jwt, getMetersStats);
  fastify.put(`${waterMeterBaseRoute}/enforcement/:meterId`, jwt, updateMeterEnforcement);
  fastify.get(`${waterMeterBaseRoute}/facility-monthly-consumption/:facilityId`, jwt, get_facility_monthly_consumption);

  // Analog Water Meters Routes
  fastify.post(`${analogMeterBaseRoute}/:facilityId`, jwt, addAnalogMeter);
  fastify.get(`${analogMeterBaseRoute}/:facilityId`, jwt, getAnalogMeters);
  fastify.get(`${analogMeterBaseRoute}/details/:facilityId/:meterId`, jwt, getAnalogMeter);
  fastify.get(`${analogMeterBaseRoute}/meter/:facilityId/:unitId`, jwt, getUnitAnalogMeter);
  fastify.put(`${analogMeterBaseRoute}/:facilityId/:meterId`, jwt, editAnalogMeter);
  fastify.put(`${analogMeterBaseRoute}/add_new_readings/:meterId`,
    {
      preHandler: [
        jwt.preHandler,
        upload.single('photo'),
        (req, res, next) => {
          next();
        },
      ],
    },
    updateReadings,
  );
  fastify.delete(`${analogMeterBaseRoute}/:facilityId/:meterId`, jwt, deleteAnalogMeter);
  fastify.get(`${analogMeterBaseRoute}/count/:facilityId`, jwt, getAnalogMeterCounts);
  fastify.get(`${analogMeterBaseRoute}/details/:facilityId`, jwt, getMeterDetailsWithConsumption);
  fastify.get(`${analogMeterBaseRoute}/customer/:facilityId/:customerId`, jwt, getCustomerMeters);
  fastify.get(`${analogMeterBaseRoute}/get_daily_readings/:meterId`, jwt, getDailyReadings);
  fastify.get(`${analogMeterBaseRoute}/get_monthly_consumption/:meterId`, jwt, getMonthlyConsumption);

  //Analog Water Meters Billing Routes
  fastify.post(
    `${analogMeterBaseRoute}/import/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.single('file')]
    },
    importAnalogMeterReadings
  );
  fastify.get(`${analogMeterBaseRoute}/get-history/:facilityId`, jwt, getAnalogBillingHistory);
  fastify.put(`${analogMeterBaseRoute}/update-meters/:facilityId`, jwt, updateBillingStatus);
  fastify.post(`${analogMeterBaseRoute}/meter/billing/:facilityId`, jwt, generateMeterBill);

  // Customer Account Routes
  fastify.post(`${customerAccountBaseRoute}/add`, jwt, addCustomerAccount);
  fastify.get(`${customerAccountBaseRoute}/get/:id`, jwt, getCustomerAccount);
  fastify.get(`${customerAccountBaseRoute}/get_customer_account/:customerId/:accountNumber`, jwt, getSingleCustomerAccount);
  fastify.put(`${customerAccountBaseRoute}/edit/:facilityId/:meterId/:accountNo`, jwt, editCustomerAccount);
  fastify.put(`${customerAccountBaseRoute}/deactivate/:facilityId/:meterId`, jwt, deactivateCustomerAccount);
  fastify.put(`${customerAccountBaseRoute}/activate/:facilityId/:meterId`, jwt, activateCustomerAccount);
  fastify.get(`${customerAccountBaseRoute}/all/:facilityId`, jwt, getAllCustomerAccount);
  fastify.get(`${customerAccountBaseRoute}/get_accounts_by_meter/:facilityId/:meterNumber`, jwt, getMeterByAcc);
  fastify.get(`${customerAccountBaseRoute}/get_accounts_debits/:accountId`, jwt, getAccDebits);
  fastify.get(`${customerAccountBaseRoute}/get_accounts_credits/:accountId`, jwt, getAccCredits);
  fastify.post(`${customerAccountBaseRoute}/add_credit/:accountNo`, jwt, addAccCredit);
  fastify.get(`${customerAccountBaseRoute}/get_accounts_balance/:accountId`, jwt, getAccBalance);
  fastify.get(`${customerAccountBaseRoute}/transactions/:accountNumber`, jwt, getCustomerTransactions);
  fastify.get(`${customerAccountBaseRoute}/monthly-consumption/:facilityId/:yearMonth`, jwt, getCustomerConsumptions);
  fastify.post(`${customerAccountBaseRoute}/customer_account/resend_onboarding`, jwt, resendOnboardingController);
  fastify.post(
    `${customerAccountBaseRoute}/import/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.single('file')]
    },
    importCustomerAccounts
  );
  // NEW — Facility-level financial summary (forwards to billing service)
  fastify.get(`${customerAccountBaseRoute}/facility-financial-summary/:facilityId`, jwt, getFacilityFinancialSummary);

  // Water Bill Invoices Routes
  fastify.get(`${waterInvoicesBaseRoute}/:facilityId`, jwt, getInvoices);
  fastify.get(`${waterInvoicesBaseRoute}/account/:invoiceId`, jwt, getInvoice);
  fastify.get(`${waterInvoicesBaseRoute}/get/:accountNumber`, jwt, getAccountInvoices);
  fastify.get(`${waterInvoicesBaseRoute}/get_meter_invoices/:meterNumber/:customerId`, jwt, getCustomerMeterInvoices);
  fastify.get(`${waterInvoicesBaseRoute}/customer/:facilityId/:customerId`, jwt, getCustomerInvoices);
  fastify.get(`${waterInvoicesBaseRoute}/filter_customer_invoices/:facilityId/filter`, jwt, filterInvoices);

  // Common Area Electricity Routes
  fastify.post(`${commonAreaElectricityBaseRoute}/add/:facilityId`, jwt, addCommonAreaElectricityReading);
  fastify.get(`${commonAreaElectricityBaseRoute}/get_all/:facilityId`, jwt, getCommonAreaElectricityReadings);
  fastify.get(`${commonAreaElectricityBaseRoute}/get_details/:facilityId/:readingId`, jwt, getCommonAreaElectricityReadingById);
  fastify.put(`${commonAreaElectricityBaseRoute}/update_reading/:facilityId/:readingId`, jwt, editCommonAreaElectricityReading);

  // Common Area Water Routes
  fastify.post(`${commonAreaWaterBaseRoute}/add/:facilityId`, jwt, addCommonAreaWaterReading);
  fastify.get(`${commonAreaWaterBaseRoute}/get_all/:facilityId`, jwt, getCommonAreaWaterReadings);
  fastify.get(`${commonAreaWaterBaseRoute}/get_details/:facilityId/:readingId`, jwt, getCommonAreaWaterReadingById);
  fastify.put(`${commonAreaWaterBaseRoute}/update_reading/:facilityId/:readingId`, jwt, editCommonAreaWaterReading);

  // Common Area Generator Routes
  fastify.post(`${commonAreaGeneratorBaseRoute}/add/:facilityId`, jwt, addCommonAreaGeneratorReading);
  fastify.get(`${commonAreaGeneratorBaseRoute}/get_all/:facilityId`, jwt, getCommonAreaGeneratorReadings);
  fastify.get(`${commonAreaGeneratorBaseRoute}/get_details/:facilityId/:readingId`, jwt, getCommonAreaGeneratorReadingById);
  fastify.put(`${commonAreaGeneratorBaseRoute}/update_reading/:facilityId/:readingId`, jwt, editCommonAreaGeneratorReading);

  // Reports Routes
  fastify.get(`${reportsBaseRoute}/facility_consumptions/:facilityId`, jwt, consumptionReports);
  fastify.get(`${reportsBaseRoute}/facility_payments/:facilityId`, jwt, paymentReports);
  fastify.get(`${reportsBaseRoute}/facility_water_billing/:facilityId`, jwt, getBillingSummaryReports);
  fastify.get(`${reportsBaseRoute}/facility_water_arrears_aging/:facilityId`, jwt, getArrearsAgingReport);
}

module.exports = { registerRoutes };