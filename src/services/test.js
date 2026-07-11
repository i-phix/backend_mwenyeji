const cron = require('node-cron');
const payservedb = require('payservedb');
const {getModel} = require('../utils/getModel');
const sendMessageToQueue = require('../utils/messaging');

const sendCredentials = async () => {
  try {
    const facilities = await payservedb.Facility.find(); // fetch all facility records
    
    for (const facility of facilities) {
      const facilityId = facility._id.toString();
      console.log("Facility ID", facilityId);
      
      const pendingCredentialsModel = await getModel('PendingCredential', payservedb.PendingCredential.schema, facilityId);

      const pendingCredentials = await pendingCredentialsModel.find({
        status: 'pending',
        retryCount: { $lt: 3 }
      }).limit(20);

      console.log(`Processing ${pendingCredentials.length} pending credentials for facility ${facilityId}`);

      for (const credential of pendingCredentials) {
        try {
          await sendMessageToQueue(
            "Payserve", 
            credential.email, 
            'PayServe LOGIN CREDENTIALS', 
            `Dear ${credential.userType}, please login to ${process.env.residentFrontEndUrl}\nUsername: ${credential.email},\nPassword: ${credential.password}\nReset your password here: \nhttps://resident.payserve.co.ke/reset_password/${credential.userId}`, 
            'Email'
          );

          await sendMessageToQueue(
            "Payserve", 
            credential.phoneNumber, 
            'PayServe LOGIN CREDENTIALS', 
            `Dear ${credential.userType}, please login to ${process.env.residentFrontEndUrl}\nUsername: ${credential.email},\nPassword: ${credential.password}\nReset your password here: \nhttps://resident.payserve.co.ke/reset_password/${credential.userId}`, 
            'SMS Meliora'
          );

          credential.status = 'sent';
          await credential.save();
          console.log(`✓ Sent credentials to ${credential.phoneNumber} [${facilityId}]`);
          console.log(`✓ Sent credentials to ${credential.email} [${facilityId}]`);
        } catch (error) {
          console.error(`× Failed to send credentials to ${credential.email} [${facilityId}]:`, error);
          credential.retryCount += 1;
          if (credential.retryCount >= 3) {
            credential.status = 'failed';
          }
          await credential.save();
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s
      }
    }
  } catch (error) {
    console.error('Error in credential sender job:', error);
  }
};


// Schedule to run every 5 minutes
const startCredentialSender = () => {
  cron.schedule('*/2 * * * *', async () => {
    await sendCredentials();
  });
  
  console.log('Credential sender job scheduled (runs every 5 minutes)');
};

module.exports = { startCredentialSender };