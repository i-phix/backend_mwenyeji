const payservedb = require('payservedb')
const delete_user = async (request, reply) => {
    try {
        const { userId } = request.params;
        await payservedb.User.findByIdAndDelete(userId);
        return reply.code(200).send('User deleted successfully.')
    }
    catch (err) {
        return reply.code(502).send(err.message)
    }

}
module.exports = delete_user