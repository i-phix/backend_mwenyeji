const payservedb = require('payservedb');

const update_penalty = async (request, reply) => {
    try {
        const { penaltyId } = request.params;
        const { effectDays, amount } = request.body;

        const query = { _id: penaltyId };

        const data = {
            effectDays: effectDays,
            amount: amount,
        };

        await payservedb.Penalty.updateOne(query, data);
        return reply.code(200).send('Penalty updated successfully');

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_penalty;
