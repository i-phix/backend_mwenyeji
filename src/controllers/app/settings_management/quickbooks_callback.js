const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const axios = require("axios");

/**
 * Handle QuickBooks OAuth callback
 * GET /api/quickbooks/callback
 */
const quickbooks_callback = async (request, reply) => {
  try {
    const { code, state, realmId, error } = request.query;

    // Handle OAuth errors
    if (error) {
      console.error(`[QUICKBOOKS][OAUTH] Authorization error: ${error}`);
      return reply.redirect("/settings/integrations?qb=error");
    }

    if (!code || !state) {
      return reply.redirect("/settings/integrations?qb=error");
    }

    // Decode state to get facilityId
    let stateData;
    try {
      const decodedState = Buffer.from(state, "base64").toString("utf-8");
      stateData = JSON.parse(decodedState);
    } catch (err) {
      console.error(`[QUICKBOOKS][OAUTH] Invalid state parameter`);
      return reply.redirect("/settings/integrations?qb=error");
    }

    const { facilityId } = stateData;

    if (!facilityId) {
      console.error(`[QUICKBOOKS][OAUTH] Missing facilityId in state`);
      return reply.redirect("/settings/integrations?qb=error");
    }

    // Get QuickBooks config
    const QuickBooksConfigModel = await getModel(
      "QuickBooksConfig",
      payservedb.QuickBooksConfig.schema,
      facilityId,
    );

    const config = await QuickBooksConfigModel.findOne({ facilityId });

    if (!config) {
      console.error(`[QUICKBOOKS][OAUTH] Config not found for facility ${facilityId}`);
      return reply.redirect("/settings/integrations?qb=error");
    }

    // Exchange authorization code for access token
    const authHeader = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64");

    const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || "http://localhost:3000/api/quickbooks/callback";

    const tokenResponse = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      },
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Calculate token expiry (1 hour from now)
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update config with tokens
    const updateData = {
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: expiresAt,
    };

    // Update realmId if provided (it should be)
    if (realmId) {
      updateData.realmId = realmId;
    }

    await QuickBooksConfigModel.findByIdAndUpdate(config._id, {
      $set: updateData,
    });

    console.log(`[QUICKBOOKS][OAUTH] Successfully obtained tokens for facility ${facilityId}`);
    console.log(`[QUICKBOOKS][OAUTH] Token expires at: ${expiresAt.toISOString()}`);

    // Redirect to success page
    return reply.redirect("/settings/integrations?qb=success");

  } catch (err) {
    console.error("[QUICKBOOKS][OAUTH] Error in callback:", err.response?.data || err.message);
    return reply.redirect("/settings/integrations?qb=error");
  }
};

module.exports = quickbooks_callback;