const headerAuth = async (request, reply) => {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    return reply.code(401).send({
      success: false,
      message: 'Missing API key'
    });
  }

  if (apiKey !== process.env.EXTERNAL_API_KEY) {
    return reply.code(403).send({
      success: false,
      message: 'Invalid API key'
    });
  }
}


module.exports = headerAuth;