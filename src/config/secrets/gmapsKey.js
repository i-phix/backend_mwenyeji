const logger = require("../../../config/winston");

// Server-side Google Places API key (used by get_place_suggestions for
// autocomplete + nearby-POI lookups). This one never reaches the browser,
// so unlike the frontend Maps JS key it's worth actually protecting.
//
// Previously this file hardcoded two of three "parts" directly as string
// literals right here in committed source, with only the first part in
// .env — meaning ~70% of the key was sitting in plain text in git the
// whole time. That's fixed now: the key lives ONLY in two env vars, split
// so the full string never appears in one place, reassembled here at
// runtime and never written back to disk.
//   GMAPS_KEY   — first chunk, as-is
//   NQ4RTK9V    — remaining chunk, character-reversed, unintelligible name
//
// Rotating the key: pick a split point, keep the first slice plain, reverse
// the rest (`secondSlice.split('').reverse().join('')`), and paste the two
// results into the two env vars in .env.

let cachedKey = null;

const readParts = () => {
  const firstSlice = process.env.GMAPS_KEY;
  const secondSliceObfuscated = process.env.NQ4RTK9V;
  if (!firstSlice || !secondSliceObfuscated) {
    throw new Error("GMAPS_KEY / NQ4RTK9V env vars not set");
  }
  const secondSlice = secondSliceObfuscated.split("").reverse().join("");
  return `${firstSlice}${secondSlice}`;
};

const getGoogleMapsApiKey = () => {
  if (cachedKey) return cachedKey;

  const key = readParts();

  if (key.length < 20) {
    logger.error("[gmapsKey] Assembled key looks suspiciously short");
  }

  cachedKey = key;
  return cachedKey;
};

const clearGoogleMapsApiKeyCache = () => {
  cachedKey = null;
};

module.exports = { getGoogleMapsApiKey, clearGoogleMapsApiKeyCache };
