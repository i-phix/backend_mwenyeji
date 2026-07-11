const db = require("payservedb");
const mongoose = require("mongoose");
const logger = require("../../../../../config/winston");

const getPOI = () => {
  const conn = db.moveInConnection;
  if (!conn) throw new Error("Move-In DB connection not ready.");
  if (conn.models["MoveInPOI"]) return conn.models["MoveInPOI"];
  return conn.model(
    "MoveInPOI",
    new mongoose.Schema({}, { strict: false, timestamps: true }),
    "moveinpois",
  );
};

const mapPoiToLandmark = (poi) => {
  const [lng, lat] = poi.location?.coordinates || [];
  return {
    _id: poi._id,
    name: poi.name,
    category: poi.category,
    area: poi.search_text || null,
    city: null,
    county: null,
    address: null,
    coordinates: lat !== undefined && lng !== undefined ? { lat, lng } : null,
    isActive: poi.isActive !== false,
    createdAt: poi.createdAt,
  };
};

const get_landmarks = async (request, reply) => {
  try {
    const { search, category, status } = request.query;
    const filter = {};
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { name: regex },
        { area: regex },
        { city: regex },
        { address: regex },
      ];
    }
    if (category) filter.category = category;
    if (status === "active") filter.isActive = { $ne: false };
    else if (status === "inactive") filter.isActive = false;

    const data = await getPOI().find(filter).sort({ createdAt: -1 }).lean();
    return reply
      .code(200)
      .send({ success: true, data: data.map(mapPoiToLandmark) });
  } catch (err) {
    logger.error("[core/move_in/landmarks/get] " + err.message);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_landmarks;
