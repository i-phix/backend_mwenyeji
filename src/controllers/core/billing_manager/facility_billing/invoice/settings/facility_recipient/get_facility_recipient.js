const payservedb = require("payservedb");

const getFacilityRecipients = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { recipientId } = request.query;

        // If recipientId is provided, get a specific recipient
        if (recipientId) {
            const recipient = await payservedb.Recipient.findOne({
                _id: recipientId,
                facilityId
            });

            if (!recipient) {
                return reply.code(404).send({
                    error: "Recipient not found"
                });
            }

            return reply.code(200).send({
                success: true,
                recipient
            });
        }

        // Get all recipients for the facility
        const recipients = await payservedb.Recipient.find({ facilityId }).sort({ createdAt: -1 });

        return reply.code(200).send({
            success: true,
            recipients,
            count: recipients.length
        });

    } catch (err) {
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = getFacilityRecipients;