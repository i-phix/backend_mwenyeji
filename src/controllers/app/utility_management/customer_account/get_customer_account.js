const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

const getUserAccount = async (request, reply) => {
  try {
    const { id } = request.params;
    
    if (!id) {
      return reply.code(400).send({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    // Get the account from utility database only
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const account = await WaterMeterAccountModel.findById(id);
    
    if (!account) {
      logger.info('User account not found', { accountId: id });
      return reply.code(404).send({
        success: false,
        message: 'User account not found',
        data: null
      });
    }
    
    // Enrich account with unit information
    let enrichedAccount = account.toObject();
    
    // Add meter serial number if available
    enrichedAccount.meterSerialNumber = account.meterNumber || 'N/A';
    enrichedAccount.unitName = 'N/A';
    
    if (account.unitId && account.facilityId) {
      try {
        const unitModel = await getModel('Unit', payservedb.Unit.schema, account.facilityId);
        const unit = await unitModel.findById(account.unitId);
        
        if (unit && unit.name) {
          enrichedAccount.unitName = unit.name;
        }
      } catch (unitError) {
        logger.warn('Failed to fetch unit information', {
          unitId: account.unitId,
          facilityId: account.facilityId,
          accountId: id,
          error: unitError.message
        });
      }
    }
    
    logger.info('Successfully fetched user account by ID', {
      accountId: id,
      facilityId: account.facilityId
    });
    
    return reply.code(200).send({
      success: true,
      message: 'User account fetched successfully',
      data: enrichedAccount
    });
  } catch (err) {
    logger.error('Error fetching user account by ID', {
      error: err.message,
      stack: err.stack,
      accountId: request.params.id
    });
    
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getUserAccount;