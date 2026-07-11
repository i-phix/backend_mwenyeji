const utilityDb = require('../../../../../middlewares/utilityDb'); 

const update_meter_status = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const { status } = request.body;

        if (!status) {
            throw new Error("Status is required");
        }

        const allowedStatuses = ['opened', 'closed', 'maintenance', 'faulty'];
        if (!allowedStatuses.includes(status)) {
            throw new Error(`Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`);
        }

        // Get the model
        const MeterModel = await utilityDb.getModel('WaterMeter');

        // Perform the status update on the meter
        const updatedMeter = await MeterModel.findByIdAndUpdate(
            meterId,
            { status },
            { new: true }
        );

        if (!updatedMeter) {
            throw new Error("Meter not found");
        }

        return reply.code(200).send({
            message: "Meter status updated successfully",
            meter: updatedMeter,
        });
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_meter_status;