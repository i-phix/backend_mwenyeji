const payservedb = require("payservedb");

const GetPrivacyPolicy = async (request, reply) => {
  try {
    const policy = await payservedb.PrivacyPolicy.findOne();

    if (!policy) {
      return reply.code(404).send({ message: "Privacy Policy not found" });
    }

    return reply.code(200).send({
      message: "Privacy Policy retrieved successfully",
      policy,
    });
  } catch (err) {
    console.error("Error in GetPrivacyPolicy:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = GetPrivacyPolicy;
