const { VertexAI } = require("@google-cloud/vertexai");

// ── Replace these with real queries against your models ────────────
// Swap these bodies for whatever your listings/viewings/applications/
// payments models actually look like (Mongoose, per your connectDB
// setup, unless you tell me otherwise).
const db = {
  async searchListings({ area, budgetMin, budgetMax, bedrooms }) {
    // TODO: query your Listing model
    return { results: [], note: "searchListings not yet wired to real DB" };
  },
  async getBookingStatus({ tenantId }) {
    // TODO: query your Viewing/Booking model
    return {
      status: "unknown",
      note: "getBookingStatus not yet wired to real DB",
    };
  },
  async getApplicationStatus({ applicationId }) {
    // TODO: query your Application model
    return {
      status: "unknown",
      note: "getApplicationStatus not yet wired to real DB",
    };
  },
  async getPaymentStatus({ tenantId }) {
    // TODO: query your Payment/Invoice model
    return {
      status: "unknown",
      note: "getPaymentStatus not yet wired to real DB",
    };
  },
};

// ── In-memory session store ─────────────────────────────────────────
// Resets on restart, won't work across multiple instances. Fine for
// local dev / single Cloud Run instance; move to Firestore/Redis if
// you scale to multiple instances.
const sessions = new Map(); // sessionId -> Vertex AI chat history array

const SYSTEM_PROMPT = `You are the Mwenyeji Assistant, embedded on mwenyeji.com — a Kenyan rental platform. Be warm, concise, and helpful.

PLATFORM FACTS (use these, don't invent alternatives):
- Rental process: Search & Discover -> Book a Viewing -> Apply Online -> Get Approved -> Reserve & Pay (M-Pesa, card, or bank) -> Move In
- Three portals: Tenant (search/apply/move in), Landlord (list/verify/approve), Agent (match/show/close)
- Pricing tiers: Affordable (from KES 3,500), Middle, Premium
- Affordable rental areas: Kawangware, Kangemi, Dagoretti, Kabiria, Riruta, Umoja, Donholm, Buruburu, South B, South C, Pipeline, Utawala, Kayole, Embakasi
- Contact: 0791 216 791, info@mwenyeji.com

Use the available tools for anything listing- or account-specific rather than guessing. If asked something outside rentals in Nairobi, chat naturally but steer back to how Mwenyeji can help.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_listings",
        description:
          "Search available rental listings by area, budget, and bedrooms",
        parameters: {
          type: "object",
          properties: {
            area: {
              type: "string",
              description: "Neighbourhood or area in Nairobi",
            },
            budgetMin: { type: "number" },
            budgetMax: { type: "number" },
            bedrooms: { type: "number" },
          },
        },
      },
      {
        name: "get_booking_status",
        description: "Get a tenant's viewing booking status",
        parameters: {
          type: "object",
          properties: { tenantId: { type: "string" } },
          required: ["tenantId"],
        },
      },
      {
        name: "get_application_status",
        description: "Get a rental application's status",
        parameters: {
          type: "object",
          properties: { applicationId: { type: "string" } },
          required: ["applicationId"],
        },
      },
      {
        name: "get_payment_status",
        description: "Get a tenant's payment/invoice status",
        parameters: {
          type: "object",
          properties: { tenantId: { type: "string" } },
          required: ["tenantId"],
        },
      },
    ],
  },
];

const FUNCTION_MAP = {
  search_listings: db.searchListings,
  get_booking_status: db.getBookingStatus,
  get_application_status: db.getApplicationStatus,
  get_payment_status: db.getPaymentStatus,
};

let model; // lazily created in the plugin so env vars are loaded first

async function chatRoutes(fastify, opts) {
  const vertexAI = new VertexAI({
    project: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || "us-central1",
  });

  model = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-001", // check Vertex AI docs for the current recommended model name
    systemInstruction: SYSTEM_PROMPT,
    tools: TOOLS,
  });

  fastify.post("/chat", async (request, reply) => {
    const { sessionId, message, tenantId } = request.body || {};

    if (!sessionId || !message) {
      return reply
        .code(400)
        .send({ success: false, error: "sessionId and message are required" });
    }

    try {
      const history = sessions.get(sessionId) || [];
      const chat = model.startChat({ history });

      let result = await chat.sendMessage(message);
      let response = result.response;

      // Handle one or more rounds of function calling
      let guard = 0;
      while (
        response.candidates?.[0]?.content?.parts?.some((p) => p.functionCall) &&
        guard < 5
      ) {
        guard++;
        const call = response.candidates[0].content.parts.find(
          (p) => p.functionCall,
        ).functionCall;
        const fn = FUNCTION_MAP[call.name];
        const args = { ...call.args, tenantId: call.args.tenantId || tenantId };
        const toolResult = fn
          ? await fn(args)
          : { error: `Unknown tool ${call.name}` };

        result = await chat.sendMessage([
          {
            functionResponse: {
              name: call.name,
              response: toolResult,
            },
          },
        ]);
        response = result.response;
      }

      const reply_text =
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join("\n") || "Sorry, I didn't catch that — could you rephrase?";

      sessions.set(sessionId, await chat.getHistory());

      return reply.send({ success: true, data: { reply: reply_text } });
    } catch (err) {
      fastify.log.error(err, "Chat route error");
      return reply
        .code(500)
        .send({ success: false, error: "Something went wrong." });
    }
  });
}

module.exports = chatRoutes;
