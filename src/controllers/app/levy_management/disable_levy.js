const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const disableLevy = async (request, reply) => {
  try {
    const { facilityId, levyId } = request.params;
    const { disabled } = request.body;

    // Get the Levy model
    const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);

    // Find the levy and update the disabled field to the provided status (true or false)
    const updatedLevy = await levyModel.findByIdAndUpdate(
      levyId,
      { disabled: disabled },
      { new: true } // Return the updated document
    );

    if (!updatedLevy) {
      return reply.code(404).send({ message: 'Levy not found' });
    }

    // Get the LevyContract model using getModel
    const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

    // If the levy is disabled, update all associated LevyContracts to 'Inactive'
    if (disabled) {
      await levyContractModel.updateMany(
        { levyId: levyId },
        { status: 'Inactive' }  // Mark contracts as Inactive
      );
    }

    return reply.code(200).send({
      message: `Levy ${disabled ? 'disabled' : 'enabled'} successfully`,
      updatedLevy,
    });
  } catch (err) {
    console.error('Error in disableLevy:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = disableLevy;
