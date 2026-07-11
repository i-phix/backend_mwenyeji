const payservedb = require('payservedb');

const update_email_settings = async (request, reply) => {
    try {
        const { facilityId, id } = request.params;
        const { user, from, host, port, auth } = request.body;

        await payservedb.Email.findOneAndUpdate(
            { _id: id, facilityId },
            {
                user,
                from,
                host,
                port,
                auth
            }
        );

        return reply.code(200).send('Email settings updated successfully');
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_email_settings;