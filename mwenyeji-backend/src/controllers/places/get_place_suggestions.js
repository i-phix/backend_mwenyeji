const Unit = require("../../models/Unit");
const Landmark = require("../../models/Landmark");
const { NAIROBI_AREAS } = require("../../data/nairobiAreas");

// GET /api/move_in/places/suggestions?q=&limit= — public
// No Google Places key on the backend (that's a frontend-only concern
// elsewhere in the app) — suggestions are drawn from real listing
// locations, active landmarks, and the curated Nairobi area list, deduped
// by name. Good enough for autocomplete without another paid API key.
async function getPlaceSuggestions(request, reply) {
  try {
    const q = String(request.query?.q || "").trim();
    const limit = Math.min(20, Number(request.query?.limit) || 8);
    if (!q) return reply.code(200).send({ success: true, data: [] });

    const regex = new RegExp(q.split(/\s+/)[0], "i"); // match on first word — callers may append a bias suffix

    const [areas, cities, counties, landmarks] = await Promise.all([
      Unit.distinct("location.area", { "location.area": regex }),
      Unit.distinct("location.city", { "location.city": regex }),
      Unit.distinct("location.county", { "location.county": regex }),
      Landmark.find({ isActive: true, name: regex }).select("name").lean(),
    ]);

    const results = new Map();
    for (const name of areas) results.set(name, { name, place: "neighbourhood" });
    for (const name of cities) results.set(name, { name, place: "city" });
    for (const name of counties) results.set(name, { name, place: "county" });
    for (const l of landmarks) if (!results.has(l.name)) results.set(l.name, { name: l.name, place: "neighbourhood" });
    for (const area of NAIROBI_AREAS) {
      if (regex.test(area.name) && !results.has(area.name)) {
        results.set(area.name, { name: area.name, place: "neighbourhood" });
      }
    }

    return reply.code(200).send({ success: true, data: [...results.values()].slice(0, limit) });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getPlaceSuggestions;
