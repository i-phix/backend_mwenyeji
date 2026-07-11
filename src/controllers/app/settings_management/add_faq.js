const payservedb = require("payservedb");

const addFAQ = async (request, reply) => {
  try {
    const { question, answer } = request.body;

    if (!question || !answer) {
      return reply.code(400).send({
        error: "Question and answer are required"
      });
    }

    const savedFAQ = await payservedb.FAQ.create({
      question,
      answer
    });

    return reply.code(200).send({message: "FAQ added successfully", faq: savedFAQ});
  } catch (err) {
    console.error("Error in addFAQ:", err);
    if (err.code === 11000) {
      return reply.code(400).send({
        error: "FAQ question already exists"
      });
    }
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addFAQ;