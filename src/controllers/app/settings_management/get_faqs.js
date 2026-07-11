const payservedb = require("payservedb");

const getFAQs = async (request, reply) => {
  try {
    const faqs = await payservedb.FAQ.find({}).sort({ createdAt: -1 });

    return reply.code(200).send({
      message: "FAQs retrieved successfully",
      faqs
    });
  } catch (err) {
    console.error("Error in getFAQs:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getFAQs;