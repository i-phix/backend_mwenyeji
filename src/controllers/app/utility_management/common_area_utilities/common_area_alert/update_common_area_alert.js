const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const updateAlertStatus = async (request, reply) => {
  try {
    const { facilityId, alertId } = request.params;
    const { status } = request.body;
    
    // Validate status
    if (!['Open', 'Resolved', 'Ignored'].includes(status)) {
      return reply.code(400).send({
        error: "Invalid status. Status must be one of: Open, Resolved, Ignored"
      });
    }

    const alertModel = await getModel(
      "CommonAreaUtilityAlert",
      payservedb.CommonAreaUtilityAlert.schema,
      facilityId
    );

    // Find the alert
    const alert = await alertModel.findById(alertId);
    
    if (!alert) {
      return reply.code(404).send({
        error: "Alert not found"
      });
    }
    
    // Update fields
    alert.status = status;
    
    if (status === 'Resolved') {
      alert.resolvedDate = new Date();
    }
    
    await alert.save();

    return reply.code(200).send({
      success: true,
      message: "Alert status updated successfully",
      data: {
        alert
      }
    });
  } catch (err) {
    console.error("Error in updateAlertStatus:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = updateAlertStatus;