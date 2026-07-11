const payservedb = require('payservedb');

const update_sms_settings = async (request, reply) => {
    try {
        const { facilityId, id } = request.params;
        const { user, senderId, apiKey } = request.body;

        await payservedb.SMSMeliora.findOneAndUpdate(
            { _id: id, facilityId },
            {
                user,
                senderId,
                apiKey
            }
        );

        return reply.code(200).send('SMS settings updated successfully');
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_sms_settings;