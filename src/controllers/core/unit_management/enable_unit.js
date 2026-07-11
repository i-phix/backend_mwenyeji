const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const logger = require('../../../../config/winston');

const enable_unit = async (request, reply) => {
   try {

      const { unitId, facilityId } = request.params
      const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)
      let query = {
         _id: unitId
      }
      let data = {
         isEnabled: true
      }
      await UnitModel.updateOne(query, data)

      return reply.code(200).send('Unit Enabled successfully')
   }
   catch (err) {
      logger.error(err.message)
      console.log(err)
      return reply.code(502).send({ error: err.message })
   }
}

module.exports = enable_unit