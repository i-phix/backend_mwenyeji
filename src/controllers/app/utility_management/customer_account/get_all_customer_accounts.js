const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

const getAllUserAccounts = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    // Get Unit model for facility-specific unit information
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    
    // Fetch accounts ONLY from utility database
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const accounts = await WaterMeterAccountModel.find({ facilityId });
    
    logger.info('Accounts fetched from utility database', {
      facilityId,
      accountCount: accounts.length
    });

    // Enrich accounts with additional information
    const accountsWithInfo = await Promise.all(
      accounts.map(async (account) => {
        const meterSerialNumber = account.meterNumber || 'N/A';
        let unitName = 'N/A';
        
        // Get unit name if unitId exists
        if (account.unitId) {
          try {
            const unit = await unitModel.findById(account.unitId);
            if (unit && unit.name) {
              unitName = unit.name;
            }
          } catch (unitError) {
            logger.warn('Failed to fetch unit information', {
              unitId: account.unitId,
              accountId: account._id,
              error: unitError.message
            });
          }
        }
        
        return {
          ...account.toObject(),
          meterSerialNumber,
          unitName
        };
      })
    );

    return reply.code(200).send({
      success: true,
      message: 'User accounts fetched successfully from utility database',
      data: accountsWithInfo,
      meta: {
        totalAccounts: accounts.length,
        facilityId,
        source: 'utility_database'
      }
    });
  } catch (err) {
    logger.error('Error in getAllUserAccounts:', {
      error: err.message,
      stack: err.stack,
      facilityId: request.params.facilityId
    });
    
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getAllUserAccounts;