const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const update_concentrator_status = async (request, reply) => {
    try {
        const { conid } = request.params; // This is the serial number
        const { status, lastCommunicationTime } = request.body;

        // Validate status input
        const allowedStatuses = ['online', 'offline', 'maintenance'];
        if (!allowedStatuses.includes(status)) {
            return reply.code(400).send({ error: `Invalid status: ${status}` });
        }

        // Find concentrator by serial number, not by ID
        const concentrator = await payservedb.Concentrator.findOne({ serialNumber: conid });

        if (!concentrator) {
            return reply.code(404).send({ error: 'Concentrator not found' });
        }

        // Update the concentrator
        concentrator.status = status;
        concentrator.lastUpdated = lastCommunicationTime;

        await concentrator.save();

        return reply.code(200).send({ 
            message: 'Concentrator status updated successfully', 
            concentrator 
        });
    } catch (err) {
        logger.error(`Error updating concentrator status: ${err.message}`);
        return reply.code(500).send({ error: 'Internal server error' });
    }
};

module.exports = update_concentrator_status;