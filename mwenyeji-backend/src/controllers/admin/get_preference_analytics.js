const GuestPreference = require("../../models/GuestPreference");

// GET /api/core/move_in/preferences — authenticated admin
// Aggregates the public preference wizard's submissions (GuestPreference)
// into the summary shape admin/preferences.js renders. GuestPreference has
// no dedicated "bedrooms"/"amenities" fields — roomTypes doubles as the
// bedroom-type breakdown and lifestyle doubles as the amenities breakdown,
// since those are the closest tag-like arrays the wizard actually collects.
function rankCounts(values) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, _id: label, count }));
}

function priceRangeLabel(min, max) {
  const value = Number(max ?? min);
  if (!value) return null;
  if (value < 10000) return "Under KES 10,000";
  if (value < 20000) return "KES 10,000 - 20,000";
  if (value < 35000) return "KES 20,000 - 35,000";
  if (value < 50000) return "KES 35,000 - 50,000";
  if (value < 100000) return "KES 50,000 - 100,000";
  return "Over KES 100,000";
}

async function getPreferenceAnalytics(request, reply) {
  try {
    const prefs = await GuestPreference.find().lean();
    const totalSubmissions = prefs.length;

    const locations = rankCounts(prefs.map((p) => p.location));
    const bedrooms = rankCounts(prefs.flatMap((p) => p.roomTypes || []));
    const listingTypes = rankCounts(prefs.map((p) => p.purpose));
    const amenities = rankCounts(prefs.flatMap((p) => p.lifestyle || []));
    const priceRanges = rankCounts(prefs.map((p) => priceRangeLabel(p.budgetMin, p.budgetMax)));

    const budgets = prefs.map((p) => Number(p.budgetMax ?? p.budgetMin)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    const median = budgets.length ? budgets[Math.floor(budgets.length / 2)] : null;

    return reply.code(200).send({
      success: true,
      data: {
        totalSubmissions,
        topLocation: locations[0]?.label || null,
        topBedrooms: bedrooms[0]?.label || null,
        medianPriceRange: median ? priceRangeLabel(median, median) : null,
        locations,
        bedrooms,
        listingTypes,
        amenities,
        priceRanges: priceRanges.filter((r) => r.label),
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getPreferenceAnalytics;
