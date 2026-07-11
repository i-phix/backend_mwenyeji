const utilityDb = require('../../../../middlewares/utilityDb');
const logger = require('../../../../../config/winston');

const editUserAccount = async (request, reply) => {
  try {
    const { facilityId, meterId, account_no } = request.params;
    const updateData = request.body;

    // Validate required parameters
    if (!facilityId) {
      throw new Error('Facility ID is required');
    }

    // Build query based on available parameters
    let query = { facilityId };
    if (meterId) {
      query.meter_id = meterId;
    } else if (account_no) {
      query.account_no = account_no;
    } else {
      throw new Error('Either meterId or account_no is required');
    }
    
    // Validate required fields for update
    if (!updateData.customerName || !updateData.phoneNumber || !updateData.email) {
      throw new Error('Customer name, phone number, and email are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updateData.email)) {
      throw new Error('Invalid email format');
    }

    // Update account in utility database
    let updatedUtilityAccount = null;
    try {
      const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
      
      updatedUtilityAccount = await WaterMeterAccountModel.findOneAndUpdate(
        query, 
        {
          customerName: updateData.customerName.trim(),
          phoneNumber: updateData.phoneNumber.trim(),
          email: updateData.email.trim().toLowerCase()
        }, 
        { new: true, runValidators: true }
      );

      if (!updatedUtilityAccount) {
        throw new Error('Account not found in utility database');
      }

      logger.info('Updated account in utility database', { 
        accountId: updatedUtilityAccount._id,
        facilityId,
        meterId,
        account_no
      });

    } catch (utilityDbError) {
      logger.error('Failed to update utility database', {
        error: utilityDbError.message,
        facilityId,
        meterId,
        account_no
      });
      throw new Error(`Failed to update account: ${utilityDbError.message}`);
    }

    return reply.code(200).send({
      success: true,
      message: 'User account updated successfully',
      data: updatedUtilityAccount
    });

  } catch (err) {
    logger.error('Error in editUserAccount:', {
      error: err.message,
      stack: err.stack,
      params: {
        facilityId: request.params.facilityId,
        meterId: request.params.meterId,
        account_no: request.params.account_no
      },
      updateData: request.body
    });
    
    return reply.code(400).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = editUserAccount;