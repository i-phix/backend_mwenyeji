const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const add_combined_units =async (request, reply)=>{
  try {
    const { facilityId } = request.params;

    const combinedUnitModel = await getModel('CombinedUnit', payservedb.CombinedUnit.schema, facilityId)
     
    let obj = {
      ...request.body,
      status: "Pending Approval",
    }
    const data = new combinedUnitModel(obj)
    await data.save();
    return reply.code(200).send('Added successfully.');

  }
  catch (err) {
    return reply.code(502).send({ error: err.message });
  }
}
module.exports = add_combined_units