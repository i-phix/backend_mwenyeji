const utilityDb = require('../../../../middlewares/utilityDb');

const getUserAccount = async (request, reply) => {
  try {
    const { customerId, accountNumber } = request.params;
    
    if (!customerId || !accountNumber) {
      return reply.code(400).send({
        success: false,
        error: 'Customer ID and Account Number are required'
      });
    }
    
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const account = await WaterMeterAccountModel.findOne({ 
      customerId, 
      account_no: accountNumber 
    });
    
    if (!account) {
      return reply.code(404).send({
        success: false,
        message: 'Account not found'
      });
    }
    
    return reply.code(200).send({
      success: true,
      data: account
    });
  } catch (err) {
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getUserAccount;