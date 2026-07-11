const { resolveShortUrl } = require('./short_url');

/**
 * Redirects a short URL to its original URL
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 */
const redirectShortUrl = async (request, reply) => {
  try {
    const { shortCode } = request.params;
    
    if (!shortCode) {
      return reply.code(400).send({
        success: false,
        message: 'Short code is required'
      });
    }
    
    const originalUrl = await resolveShortUrl(shortCode);
    
    // Perform a redirect to the original URL
    return reply.redirect(originalUrl);
  } catch (error) {
    console.error('Error redirecting short URL:', error);
    
    // If the short URL doesn't exist, redirect to the homepage or show an error page
    if (error.message === 'Short URL not found') {
      return reply.code(404).send({
        success: false,
        message: 'The requested short URL does not exist'
      });
    }
    
    return reply.code(500).send({
      success: false,
      message: error.message
    });
  }
};

module.exports = redirectShortUrl;