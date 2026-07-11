const payservedb = require('payservedb');

const update_reminder = async (request, reply) => {
    try {
        const { reminderId } = request.params;
        const { time, day } = request.body;

        const query = { _id: reminderId };

        const data = {
            time: time,
            day: day,
        };

        await payservedb.Reminder.updateOne(query, data);
        return reply.code(200).send('Reminder updated successfully');

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_reminder;
