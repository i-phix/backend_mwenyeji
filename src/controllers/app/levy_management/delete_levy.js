const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const deleteLevy = async (request, reply) => {
  try {
    const { facilityId, levyId } = request.params;

    const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);

    // Find and delete the levy
    const deletedLevy = await levyModel.findByIdAndDelete(levyId);

    if (!deletedLevy) {
      return reply.code(404).send({ message: 'Levy not found' });
    }

    return reply.code(200).send({
      message: 'Levy deleted successfully',
      deletedLevy,
    });
  } catch (err) {
    console.error('Error in deleteLevy:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = deleteLevy;
