const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

const getAccountsByMeterNumber = async (request, reply) => {
  try {
    const { facilityId, meterNumber } = request.params;

    if (!facilityId || !meterNumber) {
      return reply.code(400).send({
        error: 'Both facility ID and meter number are required'
      });
    }

    // Get WaterMeterAccount model from utility database
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

    // Query the utility database WaterMeterAccount collection
    const accounts = await WaterMeterAccountModel.find({
      facilityId,
      meterNumber
    });

    if (accounts.length === 0) {
      logger.info('No accounts found for meter number', { facilityId, meterNumber });
      return reply.code(200).send({
        message: 'No user accounts found for this meter number',
        data: []
      });
    }

    // Enrich accounts with unit information following get_meter pattern
    const accountsWithInfo = await Promise.all(
      accounts.map(async (account) => {
        const meterSerialNumber = account.meterNumber || 'N/A';
        let unitInfo = null;

        if (account.unitId && account.facilityId) {
          try {
            // Get unit from payservedb like in get_meter function
            const unitModel = await getModel('Unit', payservedb.Unit.schema, account.facilityId);
            const unit = await unitModel.findById(account.unitId);
            
            if (unit) {
              unitInfo = {
                name: unit.name
              };
              logger.info('Retrieved unit name from payservedb', {
                unitId: account.unitId,
                facilityId: account.facilityId
              });
            } else {
              logger.warn('Unit not found in payservedb', {
                unitId: account.unitId,
                facilityId: account.facilityId
              });
            }
          } catch (unitError) {
            logger.warn('Failed to fetch unit from payservedb', {
              error: unitError.message,
              unitId: account.unitId,
              facilityId: account.facilityId
            });
            // Handle unit lookup error silently like in get_meter
          }
        }

        return {
          ...account.toObject(),
          meterSerialNumber,
          UnitInfo: unitInfo,
          unitName: unitInfo ? unitInfo.name : 'N/A'
        };
      })
    );

    logger.info('Successfully fetched accounts by meter number', {
      facilityId,
      meterNumber,
      accountCount: accounts.length
    });

    return reply.code(200).send({
      message: 'User accounts fetched successfully from utility database',
      data: accountsWithInfo
    });
  } catch (err) {
    logger.error('Error fetching accounts by meter number', {
      error: err.message,
      stack: err.stack,
      facilityId: request.params.facilityId,
      meterNumber: request.params.meterNumber
    });

    return reply.code(502).send({ error: err.message });
  }
};

module.exports = getAccountsByMeterNumber;