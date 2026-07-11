const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

const getMonthlyConsumption = async (request, reply) => {
  try {
    const { facilityId, yearMonth } = request.params;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    if (!yearMonth) {
      return reply.code(400).send({
        success: false,
        error: 'Year-Month is required (format: YYYY-MM)'
      });
    }

    // Validate yearMonth format
    const yearMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!yearMonthRegex.test(yearMonth)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid year-month format. Expected format: YYYY-MM'
      });
    }

    // Get models
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Fetch all meters for the facility (this is the primary source)
    const meters = await WaterMeterModel.find({ facilityId });

    if (!meters || meters.length === 0) {
      return reply.code(200).send({
        success: true,
        message: 'No meters found for this facility',
        data: [],
        meta: {
          totalMeters: 0,
          facilityId,
          yearMonth,
          metersWithConsumption: 0
        }
      });
    }

    logger.info('Processing monthly consumption data', {
      facilityId,
      yearMonth,
      totalMeters: meters.length
    });

    // Create a map of accounts for quick lookup
    const accounts = await WaterMeterAccountModel.find({ facilityId });
    const accountMap = new Map();
    accounts.forEach(account => {
      if (account.meter_id) {
        accountMap.set(account.meter_id.toString(), account);
      }
    });

    // Process meters and fetch consumption data
    const consumptionData = await Promise.all(
      meters.map(async (meter) => {
        let consumption = 0;
        let initialReading = 0;
        let finalReading = 0;
        let hasConsumptionData = false;

        // Get consumption data from monthly history
        try {
          const monthlyHistory = await MonthlyWaterMeterHistoryModel.findOne({
            meterId: meter._id,
            yearMonth: yearMonth
          });

          if (monthlyHistory) {
            consumption = parseFloat(monthlyHistory.consumption.toFixed(2));
            initialReading = parseFloat(monthlyHistory.initialReading.toFixed(2));
            finalReading = parseFloat(monthlyHistory.finalReading.toFixed(2));
            hasConsumptionData = true;
          }
        } catch (consumptionError) {
          logger.warn('Failed to fetch consumption data', {
            meterId: meter._id,
            error: consumptionError.message
          });
        }

        // Get customer details from account (if exists)
        const account = accountMap.get(meter._id.toString());
        let customerName = 'N/A';
        let phoneNumber = 'N/A';
        let email = 'N/A';
        let accountNumber = meter.accountNumber || 'N/A';

        if (account) {
          customerName = account.customerName || 'N/A';
          phoneNumber = account.phoneNumber || 'N/A';
          email = account.email || 'N/A';
          accountNumber = account.account_no || accountNumber;
        }

        // Get unit name
        let unitName = 'N/A';
        if (meter.unitId) {
          try {
            const unit = await unitModel.findById(meter.unitId);
            if (unit && unit.name) {
              unitName = unit.name;
            }
          } catch (unitError) {
            logger.warn('Failed to fetch unit information', {
              unitId: meter.unitId,
              error: unitError.message
            });
          }
        }
        // Fallback to account unitName if available
        if (unitName === 'N/A' && account && account.unitName) {
          unitName = account.unitName;
        }

        return {
          meterId: meter._id,
          accountId: account ? account._id : null,
          accountNumber: accountNumber,
          customerName: customerName,
          phoneNumber: phoneNumber,
          email: email,
          meterNumber: meter.meterNumber || 'N/A',
          unitName: unitName,
          paymentType: meter.customerType || (account ? account.payment_type : 'N/A'),
          status: meter.status || 'N/A',
          yearMonth: yearMonth,
          initialReading: initialReading,
          finalReading: finalReading,
          consumption: consumption,
          hasConsumptionData: hasConsumptionData,
          hasCustomerAccount: !!account
        };
      })
    );

    // Calculate statistics
    const metersWithConsumption = consumptionData.filter(d => d.hasConsumptionData).length;
    const metersWithAccounts = consumptionData.filter(d => d.hasCustomerAccount).length;
    const totalConsumption = consumptionData.reduce((sum, d) => sum + d.consumption, 0);

    return reply.code(200).send({
      success: true,
      message: 'Monthly consumption data fetched successfully',
      data: consumptionData,
      meta: {
        totalMeters: meters.length,
        metersWithConsumption: metersWithConsumption,
        metersWithAccounts: metersWithAccounts,
        metersWithoutAccounts: meters.length - metersWithAccounts,
        totalConsumption: parseFloat(totalConsumption.toFixed(2)),
        facilityId,
        yearMonth
      }
    });
  } catch (err) {
    logger.error('Error in getMonthlyConsumption:', {
      error: err.message,
      stack: err.stack,
      facilityId: request.params.facilityId,
      yearMonth: request.params.yearMonth
    });

    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getMonthlyConsumption;