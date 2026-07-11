const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get Water Consumption Report Per Unit/Property
 * Handles both prepaid and postpaid meters
 */
const getConsumptionReport = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      searchQuery, 
      meterType, 
      paymentType, 
      startDate, 
      endDate,
      limit = 50, 
      skip = 0 
    } = request.query;
    
    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    // Get models from utility database
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');

    // Build query for meters
    const meterQuery = { facilityId };
    
    if (meterType && meterType !== 'All Meters') {
      // Note: your database has lowercase "smart", not "Smart"
      meterQuery.meterType = meterType === 'Smart Meters' ? 'smart' : 'analog';
    }

    // Get all meters for the facility
    const meters = await WaterMeterModel.find(meterQuery).lean();
    const meterIds = meters.map(m => m._id);

    console.log('Found meters:', meterIds.length); // Debug log

    // Build query for accounts - FIXED FIELD NAME
    const accountQuery = { meter_id: { $in: meterIds } }; // Changed from meterId to meter_id
    
    if (paymentType && paymentType !== 'All Types') {
      // FIXED: Use payment_type instead of accountType
      accountQuery.payment_type = paymentType; // e.g., "Prepaid" or "Postpaid"
    }

    // Get accounts
    const accounts = await WaterMeterAccountModel.find(accountQuery).lean();
    
    console.log('Found accounts:', accounts.length); // Debug log

    // Build query for monthly history
    const historyQuery = { meterId: { $in: meterIds } };
    
    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const yearMonths = [];
      
      let current = new Date(start);
      while (current <= end) {
        yearMonths.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
        current.setMonth(current.getMonth() + 1);
      }
      
      historyQuery.yearMonth = { $in: yearMonths };
    }

    // Get monthly history records
    const historyRecords = await MonthlyWaterMeterHistoryModel.find(historyQuery)
      .sort({ yearMonth: -1 })
      .lean();

    console.log('Found history records:', historyRecords.length); // Debug log

    // Get customer information
    const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
    const customerIds = [...new Set(accounts.map(a => a.customerId?.toString()).filter(Boolean))];
    const customers = await CustomerModel.find({ _id: { $in: customerIds } }).lean();
    const customerMap = {};
    customers.forEach(c => {
      customerMap[c._id.toString()] = c.customerName || `${c.firstName || ''} ${c.lastName || ''}`.trim();
    });

    // Get unit information
    const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const unitIds = [...new Set(accounts.map(a => a.unitId?.toString()).filter(Boolean))];
    const units = await UnitModel.find({ _id: { $in: unitIds } }).lean();
    const unitMap = {};
    units.forEach(u => {
      unitMap[u._id.toString()] = u.name;
    });

    // Create meter map
    const meterMap = {};
    meters.forEach(m => {
      meterMap[m._id.toString()] = m;
    });

    // Create account map - FIXED: Use meter_id as key
    const accountMap = {};
    accounts.forEach(a => {
      accountMap[a.meter_id.toString()] = a; // Changed from meterId to meter_id
    });

    // Process consumption data
    let consumptionData = [];

    historyRecords.forEach(history => {
      const meter = meterMap[history.meterId.toString()];
      const account = accountMap[history.meterId.toString()];
      
      if (!meter || !account) {
        console.log('Missing meter or account for history:', history.meterId.toString()); // Debug
        return;
      }

      const customerName = customerMap[account.customerId?.toString()] || account.customerName || 'N/A';
      const unitName = unitMap[account.unitId?.toString()] || 'N/A';
      
      // Calculate average daily consumption
      const daysInPeriod = 30; // Approximate
      const avgDaily = history.consumption ? (history.consumption / daysInPeriod).toFixed(2) : '0.00';

      // Determine status based on consumption
      let status = 'Normal';
      if (history.consumption > 50) {
        status = 'High Usage';
      } else if (history.consumption < 5) {
        status = 'Low Usage';
      }

      consumptionData.push({
        unitName: unitName, // Now fetched from Unit model
        customerName,
        meterNumber: meter.meterNumber || account.meterNumber,
        meterType: meter.meterType || 'N/A',
        paymentType: account.payment_type || 'N/A', // Changed from accountType
        previousReading: history.initialReading,
        currentReading: history.finalReading,
        consumption: history.consumption,
        avgDaily,
        period: history.yearMonth,
        status
      });
    });

    // Apply search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      consumptionData = consumptionData.filter(item => 
        item.unitName?.toLowerCase().includes(search) ||
        item.customerName?.toLowerCase().includes(search) ||
        item.meterNumber?.toLowerCase().includes(search)
      );
    }

    // Pagination
    const totalCount = consumptionData.length;
    const paginatedData = consumptionData.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    return reply.code(200).send({
      success: true,
      message: 'Consumption report retrieved successfully',
      data: {
        totalCount,
        records: paginatedData,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: totalCount > (parseInt(skip) + parseInt(limit)),
          currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

  } catch (err) {
    console.error('Error in getConsumptionReport:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getConsumptionReport;