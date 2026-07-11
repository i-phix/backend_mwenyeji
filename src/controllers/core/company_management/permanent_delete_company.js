const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const permanent_delete_company = async (request,reply)=>{
   try{
      const { id }= request.params
      await payservedb.Company.deleteOne({_id:id})
      return reply.code(200).send('Deleted successfully')
   }
   catch (err) {
      logger.error(err.message)
      console.log(err)
      return reply.code(502).send({ error: err.message })
   }
}
module.exports = permanent_delete_company