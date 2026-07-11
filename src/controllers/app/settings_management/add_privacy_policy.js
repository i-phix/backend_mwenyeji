const payservedb = require("payservedb");

const AddPrivacyPolicy = async (request, reply) => {
    try {
        const { content } = request.body;

        if (!content) {
            return reply.code(400).send({ error: "Privacy Policy content is required" });
        }

        // Upsert — only one privacy policy document should exist
        const policy = await payservedb.PrivacyPolicy.findOneAndUpdate(
            {},
            { title: "Privacy Policy", content },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return reply.code(200).send({
            message: "Privacy Policy saved successfully",
            policy,
        });
    } catch (err) {
        console.error("Error in AddPrivacyPolicy:", err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = AddPrivacyPolicy;
