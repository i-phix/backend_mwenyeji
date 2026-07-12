const GuestPreference = require("../../models/GuestPreference");

// POST /api/move_in/preferences/save — public (no auth; guestId identifies
// the caller). Fire-and-forget from the frontend's perspective — upserts
// so re-submitting from the same guestId updates rather than duplicates.
async function savePreferences(request, reply) {
  try {
    const { guestId, purpose, location, roomTypes, lifestyle, budgetMin, budgetMax } = request.body || {};
    if (!guestId) return reply.code(400).send({ error: "guestId is required" });

    const pref = await GuestPreference.findOneAndUpdate(
      { guestId },
      {
        guestId,
        purpose: purpose || "any",
        location: location || undefined,
        roomTypes: Array.isArray(roomTypes) ? roomTypes : [],
        lifestyle: Array.isArray(lifestyle) ? lifestyle : [],
        budgetMin: budgetMin ?? undefined,
        budgetMax: budgetMax ?? undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return reply.code(200).send({ success: true, data: pref });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = savePreferences;
