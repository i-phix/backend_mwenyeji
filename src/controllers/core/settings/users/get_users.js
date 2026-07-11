const payservedb = require('payservedb')
const get_users = async (request, reply) => {
    try {
        const users = await payservedb.User.find({ type: "Universal" }).sort({_id:-1});
        console.log(users)
        return reply.code(200).send(users)
    }
    catch (err) {
        return reply.code(502).send(err.message)
    }
}
module.exports = get_users