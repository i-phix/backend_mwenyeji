const ViewingSlot = require("../../models/ViewingSlot");
const Unit = require("../../models/Unit");

// GET /api/move_in/viewing/available — public
// Query: unitId (optional filter)
// Returns slots grouped by unit: [{ unitId, unitName, slots: [...] }]
async function getAvailableSlots(request, reply) {
  try {
    const { unitId } = request.query || {};

    const filter = { status: "active", date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } };
    if (unitId) filter.unitId = unitId;

    const slots = await ViewingSlot.find(filter).sort({ date: 1, time: 1 }).lean();
    const openSlots = slots.filter((s) => s.bookedCount < s.capacity);

    const unitIds = [...new Set(openSlots.map((s) => String(s.unitId)))];
    const units = await Unit.find({ _id: { $in: unitIds } }).select("title").lean();
    const unitNameById = new Map(units.map((u) => [String(u._id), u.title]));

    const groups = new Map();
    for (const s of openSlots) {
      const key = String(s.unitId);
      if (!groups.has(key)) {
        groups.set(key, { unitId: s.unitId, unitName: unitNameById.get(key) || "Unit", slots: [] });
      }
      groups.get(key).slots.push({
        _id: s._id,
        date: s.date,
        time: s.time,
        durationMins: s.durationMins,
        availableSeats: s.capacity - s.bookedCount,
      });
    }

    return reply.code(200).send({ success: true, data: [...groups.values()] });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getAvailableSlots;
