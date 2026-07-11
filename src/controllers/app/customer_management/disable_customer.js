const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const disable_customer = async (request, reply) => {
   try {
      const { customerId } = request.params
      const customer = await payservedb.Customer.findById(customerId)
      let query = {
         _id: customerId
      }
      let data = {
         isEnabled: false
      }
      await payservedb.Customer.updateOne(query, data)

      return reply.code(200).send('Disabled successfully')
   }
   catch (err) {
      logger.error(err.message)
      console.log(err)
      return reply.code(502).send({ error: err.message })
   }
}
module.exports = disable_customer