const payservedb = require('payservedb'); // Assuming payservedb is your DB connection

const faq = async (request, reply) => {
    try {
        const {facilityId} = request.params
        const faqs = await payservedb.FAQ.find({facilityId});

        return reply.code(200).send(faqs)
    }
    catch (err) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}
module.exports = faq