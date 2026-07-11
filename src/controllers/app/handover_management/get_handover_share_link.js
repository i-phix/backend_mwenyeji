const { createShortUrl } = require("../../../utils/url_shortener/short_url");

const get_handover_share_link = async (request, reply) => {
  try {
    const { facilityId, handoverId } = request.params;

    if (!facilityId || !handoverId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID and handover ID are required.",
      });
    }

    const baseUrl =
      process.env.BACKEND_URL ||
      `${request.protocol}://${request.headers.host}`;

    const longUrl = `${baseUrl}/api/app/handover_management/public/handover_pdf/${facilityId}/${handoverId}`;
    const shortCode = await createShortUrl(longUrl);

    if (request.server?.redis) {
      await request.server.redis.set(`url:short:${shortCode}`, longUrl, "EX", 31536000);
    }

    return reply.send({
      success: true,
      longUrl,
      shortUrl: `${baseUrl}/s/${shortCode}`,
      shortCode,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      error: error.message || "Failed to create handover share link.",
    });
  }
};

module.exports = get_handover_share_link;
