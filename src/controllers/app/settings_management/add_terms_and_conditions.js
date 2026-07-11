const payservedb = require("payservedb");

const AddTermsAndConditions = async (request, reply) => {
  try {
    const { content } = request.body;

    if (!content) {
      return reply.code(400).send({ error: "Terms & Conditions content is required" });
    }

    // Upsert — ensure only one document exists
    const terms = await payservedb.TermsAndConditions.findOneAndUpdate(
      {},
      { title: "Terms & Conditions", content },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return reply.code(200).send({
      message: "Terms & Conditions saved successfully",
      terms,
    });
  } catch (err) {
    console.error("Error in AddTermsAndConditions:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = AddTermsAndConditions;
