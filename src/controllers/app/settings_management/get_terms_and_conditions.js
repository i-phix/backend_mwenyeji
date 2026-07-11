const payservedb = require("payservedb");

const GetTermsAndConditions = async (request, reply) => {
  try {
    console.log("11111111")
    const terms = await payservedb.TermsAndConditions.findOne();

    if (!terms) {
      return reply.code(404).send({ message: "Terms & Conditions not found" });
    }

    console.log(222222222)

    return reply.code(200).send({
      message: "Terms & Conditions retrieved successfully",
      terms,
    });
  } catch (err) {
    console.error("Error in GetTermsAndConditions:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = GetTermsAndConditions;
