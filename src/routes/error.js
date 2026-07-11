
async function registerRoutes(fastify) {
    fastify.get('/404-not-found', async (request, reply) => {
        return reply.status(400).send({ error: '404 NOT FOUND' });
    });
}
module.exports = { registerRoutes };