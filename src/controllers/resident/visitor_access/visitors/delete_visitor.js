const payservedb = require('payservedb');
const { getModel } = require("../../../../utils/getModel");

const delete_visitor = async (request, reply) => {
  try {
    const { facilityId, visitorId } = request.params;

    const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);
    const result = await visitorModel.findByIdAndDelete(visitorId);

    if (!result) {
      return reply.code(404).send('Visitor not found');
    }

    return reply.code(200).send('Deleted successfully');
  } catch (err) {
    return reply.code(502).send(`Error deleting visitor: ${err.message}`);
  }
};

module.exports = delete_visitor;
