const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getAnalogBillingHistory = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'facilityId is required',
      });
    }

    // Get the AnalogBilling model from the utility DB
    const analogBillingModel = await utilityDb.getModel('AnalogBilling');

    // Find latest billing record
    const latestRecord = await analogBillingModel.findOne({ facilityId })
      .sort({ yearMonth: -1, createdAt: -1 })
      .lean();

    if (!latestRecord) {
      return reply.code(200).send({ data: [] });
    }

    const latestYearMonth = latestRecord.yearMonth;

    // Get all current records for that month
    const billingHistory = await analogBillingModel.find({
      facilityId,
      yearMonth: latestYearMonth
    }).sort({ createdAt: -1 }).lean();

    const meterNumbers = [...new Set(billingHistory.map(r => r.meterNumber))];

    // Compute previous 3 months
    const [latestYear, latestMonth] = latestYearMonth.split('-').map(Number);
    const previousMonths = [];
    for (let i = 1; i <= 3; i++) {
      let month = latestMonth - i;
      let year = latestYear;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      previousMonths.push(`${year}-${month.toString().padStart(2, '0')}`);
    }

    // Get previous month readings
    const previousData = await analogBillingModel.find({
      facilityId,
      meterNumber: { $in: meterNumbers },
      yearMonth: { $in: previousMonths }
    }).lean();

    // Group previous readings by meter
    const meterPreviousReadings = {};
    previousData.forEach(record => {
      if (!meterPreviousReadings[record.meterNumber]) {
        meterPreviousReadings[record.meterNumber] = [];
      }
      meterPreviousReadings[record.meterNumber].push(record);
    });

    // Get customer model from payservedb
    const customerModel = await getModel('Customer', payservedb.Customer.schema);

    // Format results
    const formattedHistory = await Promise.all(billingHistory.map(async (record) => {
      let customerInfo = 'N/A';

      if (record.customerId) {
        try {
          const customer = await customerModel.findById(record.customerId);
          if (customer?.firstName || customer?.lastName) {
            customerInfo = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
          }
        } catch (_) {}
      }

      const previousReadings = meterPreviousReadings[record.meterNumber] || [];
      const totalPreviousUsage = previousReadings.reduce((sum, r) => sum + (parseFloat(r.totalUsage) || 0), 0);
      const threeMonthAvgUsage = previousReadings.length ? totalPreviousUsage / previousReadings.length : 0;

      return {
        _id: record._id,
        meterNumber: record.meterNumber,
        previousReading: record.previousReading,
        currentReading: record.currentReading,
        totalUsage: record.totalUsage,
        yearMonth: record.yearMonth,
        status: record.status,
        customerInfo,
        unitInfo: record.unitName || 'N/A',
        threeMonthAvgUsage,
        previousMonthsCount: previousReadings.length,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    }));

    return reply.code(200).send({ data: formattedHistory });
  } catch (err) {
    console.error('Error in getAnalogBillingHistory:', err);
    return reply.code(500).send({ success: false, error: err.message });
  }
};

module.exports = getAnalogBillingHistory;
