const mongoose = require("mongoose");

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeCoordinates = (coordinates) => {
  if (!coordinates) return null;

  // Handle GeoJSON array [lng, lat]
  if (Array.isArray(coordinates)) {
    if (coordinates.length < 2) return null;
    const lat = toNumber(coordinates[1]);
    const lng = toNumber(coordinates[0]);
    if (lat === null || lng === null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  if (typeof coordinates !== "object") return null;

  const lat = toNumber(coordinates.lat ?? coordinates.latitude);
  const lng = toNumber(coordinates.lng ?? coordinates.longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const sanitizeLocation = (location) => {
  const { coordinates, ...safeLocation } = location || {};
  return safeLocation;
};

const DEFAULT_PROXIMITY_RADIUS_M = 300;

// Simple deterministic 32-bit hash (djb2-ish) so the same listing id always
// produces the same jitter — the point must NOT move around on refresh,
// otherwise repeated samples could be averaged to reveal the real location.
const seedFromString = (value) => {
  const str = String(value || '');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
};

// Deterministic PRNG (mulberry32) seeded from the listing id — gives us two
// independent-enough pseudo-random numbers in [0, 1) for angle + distance.
const mulberry32 = (seed) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Takes an exact lat/lng and returns a fuzzed point within `radiusM` metres,
 * deterministically derived from `seed` (e.g. the listing id). This is used
 * to show a "proximity area" on the map instead of the unit's real location —
 * the exact coordinates should never reach the client.
 */
const approximateCoordinates = (coordinates, seed, radiusM = DEFAULT_PROXIMITY_RADIUS_M) => {
  const exact = normalizeCoordinates(coordinates);
  if (!exact) return null;

  const rand = mulberry32(seedFromString(seed));
  const angle = rand() * 2 * Math.PI;
  // sqrt() keeps the jitter uniformly distributed over the disk area rather
  // than clustering points near the centre.
  const distanceM = Math.sqrt(rand()) * radiusM;

  const earthRadiusM = 6371000;
  const dLat = (distanceM * Math.cos(angle)) / earthRadiusM;
  const dLng =
    (distanceM * Math.sin(angle)) /
    (earthRadiusM * Math.cos((exact.lat * Math.PI) / 180));

  const lat = exact.lat + (dLat * 180) / Math.PI;
  const lng = exact.lng + (dLng * 180) / Math.PI;

  return { lat, lng, radiusM };
};

const distanceKm = (from, to) => {
  const earthRadiusKm = 6371;
  const degToRad = (deg) => deg * (Math.PI / 180);
  const dLat = degToRad(to.lat - from.lat);
  const dLng = degToRad(to.lng - from.lng);
  const lat1 = degToRad(from.lat);
  const lat2 = degToRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const nearestLandmarks = async (coordinates, options = {}) => {
  const unitCoordinates = normalizeCoordinates(coordinates);
  if (!unitCoordinates) return [];

  const limit = Math.max(1, Math.min(Number(options.limit || 5), 12));
  const maxDistanceKm = Number(options.maxDistanceKm || 25);

  try {
    const connections = mongoose.connections;
    const moveInConn = connections.find(
      (c) => c.name === "payserve_movein" && c.readyState === 1,
    );
    if (!moveInConn) return [];

    const MoveInPOI =
      moveInConn.models["MoveInPOI"] ||
      moveInConn.model(
        "MoveInPOI",
        new mongoose.Schema({}, { strict: false }),
        "moveinpois",
      );

    const pois = await MoveInPOI.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [unitCoordinates.lng, unitCoordinates.lat],
          },
          $maxDistance: maxDistanceKm * 1000,
        },
      },
    })
      .select("name category area address")
      .limit(limit)
      .lean();

    return pois
      .filter((p) => p.name)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        area: p.area,
        address: p.address,
      }));
  } catch (e) {
    return [];
  }
};

module.exports = {
  distanceKm,
  nearestLandmarks,
  normalizeCoordinates,
  sanitizeLocation,
  approximateCoordinates,
  DEFAULT_PROXIMITY_RADIUS_M,
};
