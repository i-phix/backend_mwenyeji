const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const crypto = require("crypto");

/**
 * Initiate QuickBooks OAuth flow
 * GET /api/app/settings_management/connect_quickbooks/:facilityId
 */
const connect_quickbooks = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Get QuickBooks config
    const QuickBooksConfigModel = await getModel(
      "QuickBooksConfig",
      payservedb.QuickBooksConfig.schema,
      facilityId,
    );

    const config = await QuickBooksConfigModel.findOne({ facilityId });

    if (!config) {
      return reply.code(404).send({
        success: false,
        error: "QuickBooks configuration not found. Please save credentials first.",
      });
    }

    // Generate random state for security
    const state = crypto.randomBytes(16).toString("hex");

    // Store state and facilityId in session or temporary storage
    // For simplicity, we'll encode it in the state parameter
    const stateData = {
      state: state,
      facilityId: facilityId,
      timestamp: Date.now(),
    };
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString("base64");

    // Build OAuth authorization URL
    // FIXED: Use localhost:3001 to match your frontend port
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || "http://localhost:3001/api/quickbooks/callback";
    
    const authParams = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      redirect_uri: redirectUri,
      state: encodedState,
    });

    const authUrl = `https://appcenter.intuit.com/connect/oauth2?${authParams.toString()}`;

    console.log(`[QUICKBOOKS][OAUTH] Redirecting to authorization URL for facility ${facilityId}`);
    console.log(`[QUICKBOOKS][OAUTH] Redirect URI: ${redirectUri}`);
    console.log(`[QUICKBOOKS][OAUTH] Auth URL: ${authUrl}`);

    // Redirect user to QuickBooks authorization page
    // Use status code 302 for temporary redirect
    reply.statusCode = 302;
    reply.header('Location', authUrl);
    return reply.send();

  } catch (err) {
    console.error("Error in connect_quickbooks:", err);
    return reply.code(500).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = connect_quickbooks;