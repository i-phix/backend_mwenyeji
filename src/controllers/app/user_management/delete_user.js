const delete_user = async (request, reply) => {
    try {
        const { userId } = request.params;

        const deleted = await payservedb.User.findByIdAndDelete(userId);

        if (!deleted) {
            return reply.code(404).send({ error: 'User not found or already deleted' });
        }

        return reply.send({ message: 'User deleted successfully' });
    } catch (err) {
        console.log(err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = delete_user;
