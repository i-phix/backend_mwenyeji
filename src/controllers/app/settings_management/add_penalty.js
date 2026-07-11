const payservedb = require("payservedb");
const { getModel } = require('../../../utils/getModel');

const add_penalty = async (request, reply) => {
    try {

        const { name, type, effectDays, percentage, amount, isActive, levyId } =
            request.body;
        const { facilityId } = request.params;

        if (!name || !type || !effectDays || !amount || !isActive || !levyId) {
            return reply
                .code(400)
                .send({ error: "Missing required fields in request body" });
        }

        const penaltyModel = await getModel("Penalty", payservedb.Penalty.schema, facilityId);

        const penaltyExist = await penaltyModel.findOne({ name });

        if (penaltyExist) {
            throw new Error("Penalty already exists.");
        } else {
            let data = new penaltyModel({
                facilityId,
                name,
                type,
                effectDays,
                percentage,
                amount,
                isActive,
                levyId
            });


            const response = await data.save();


            return reply.code(200).send({ message: "Penalty has been added." });
        }
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_penalty;
