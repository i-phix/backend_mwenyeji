const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const update_concentrator_status = async (request, reply) => {
  try {
    const { concentratorId } = request.params;
    const { status } = request.body;

    logger.info(`Received request to update concentrator ${concentratorId} to status: ${status}`);

    if (!status) {
      throw new Error("Status is required");
    }

    const allowedStatuses = ['Online', 'Offline', 'Maintenance'];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`);
    }

    const Concentrator = payservedb.Concentrator;

    const updatedConcentrator = await Concentrator.findByIdAndUpdate(
      concentratorId,
      { status },
      { new: true }
    );

    if (!updatedConcentrator) {
      throw new Error("Concentrator not found");
    }

    logger.info(`Concentrator ${concentratorId} updated successfully to status: ${status}`);
    return reply.code(200).send({
      message: "Concentrator status updated successfully",
      concentrator: updatedConcentrator,
    });
  } catch (err) {
    logger.error("Error updating concentrator status:", err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = update_concentrator_status;
