const payservedb = require('payservedb')
const get_messages = async (request, reply) => {
    try {
        const messages = await payservedb.Message.find().sort({ _id: -1 })
        return reply.code(200).send(messages)
    }
    catch (err) {
        return reply.code(502).send(err.message)
    }
}
module.exports = get_messages