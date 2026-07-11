const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const axios = require("axios");

/**
 * Disconnect QuickBooks (revoke tokens)
 * POST /api/facilities/:facilityId/integrations/quickbooks/disconnect
 */
const disconnect_quickbooks = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const QuickBooksConfigModel = await getModel(
      "QuickBooksConfig",
      payservedb.QuickBooksConfig.schema,
      facilityId,
    );

    const config = await QuickBooksConfigModel.findOne({ facilityId });

    if (!config) {
      return reply.code(404).send({
        success: false,
        error: "QuickBooks configuration not found",
      });
    }

    // Revoke tokens with QuickBooks
    if (config.refreshToken) {
      try {
        const authHeader = Buffer.from(
          `${config.clientId}:${config.clientSecret}`,
        ).toString("base64");

        await axios.post(
          "https://oauth.platform.intuit.com/oauth2/v1/tokens/revoke",
          new URLSearchParams({
            token: config.refreshToken,
          }),
          {
            headers: {
              Authorization: `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
          },
        );

        console.log(`[QUICKBOOKS][OAUTH] Successfully revoked tokens for facility ${facilityId}`);
      } catch (revokeError) {
        // Log but don't fail - we'll clear tokens anyway
        console.error(`[QUICKBOOKS][OAUTH] Error revoking tokens:`, revokeError.response?.data || revokeError.message);
      }
    }

    // Clear tokens from database
    await QuickBooksConfigModel.findByIdAndUpdate(config._id, {
      $set: {
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    });

    return reply.send({
      success: true,
      message: "QuickBooks disconnected successfully",
    });

  } catch (err) {
    console.error("Error in disconnect_quickbooks:", err);
    return reply.code(500).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = disconnect_quickbooks;