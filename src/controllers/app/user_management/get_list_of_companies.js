const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const get_list_of_companies = async (request,reply)=>{
  try{
     const { user } = request
     const userExist = await payservedb.User.findById(user.userId);
     if (userExist) {
         let companies = userExist.companies;
        
         let array = [];
         for (const company of companies) {
             let companyExist = await payservedb.Company.findById(company);
             if (companyExist) {
                 array.push(companyExist);
             }
         }
         logger.info('Retrieved list of companies '+userExist)
         return reply.code(200).send({array})
     }
     
  }
  catch (err) {
    logger.error(err.message)
    return reply.code(502).send({ error: err.message })
  }
}
module.exports = get_list_of_companies