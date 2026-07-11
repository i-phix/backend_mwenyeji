const logger = require("../../../../config/winston");
const { getGoogleMapsApiKey } = require("../../../config/secrets/gmapsKey");

const TYPE_TO_CHIP = {
  hospital: "Hospital",
  doctor: "Hospital",
  clinic: "Hospital",
  school: "School",
  bank: "Bank",
  pharmacy: "Pharmacy",
  restaurant: "Restaurant",
  supermarket: "Supermarket",
  gas_station: "Petrol Station",
  bus_station: "Bus Stop",
  transit_station: "Bus Stop",
  shopping_mall: "Mall",
  market: "Mall",
};

const get_place_suggestions = async (request, reply) => {
  try {
    const { q = "", limit = 8 } = request.query;

    if (!q || q.trim().length < 1) {
      return reply.code(200).send({ success: true, data: [] });
    }

    let apiKey;
    try {
      apiKey = getGoogleMapsApiKey();
    } catch (keyErr) {
      logger.error("[move_in/get_place_suggestions] " + keyErr.message);
      return reply.code(503).send({ error: "Google Maps not configured" });
    }

    const search = q.trim();
    const cap = Math.min(Number(limit) || 8, 20);

    // ── Step 1: Autocomplete suggestions restricted to Kenya ──
    const autocompleteRes = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input: search,
          includedRegionCodes: ["ke"],
          languageCode: "en",
        }),
      },
    );

    const autocompleteData = await autocompleteRes.json();

    if (!autocompleteRes.ok) {
      logger.error(
        "[move_in/get_place_suggestions] Autocomplete error: " +
          JSON.stringify(autocompleteData),
      );
      return reply.code(502).send({ error: "Google Maps autocomplete failed" });
    }

    const suggestions = (autocompleteData.suggestions || [])
      .filter((s) => s.placePrediction)
      .slice(0, cap)
      .map((s) => s.placePrediction);

    // ── Step 2: Enrich each suggestion with details + nearby POIs ──
    const enriched = await Promise.all(
      suggestions.map(async (s) => {
        const placeId = s.placeId;
        const name = s.structuredFormat?.mainText?.text || s.text?.text || "";

        const base = {
          place_id: placeId,
          name,
          formatted_address: s.text?.text || "",
          city: "",
          county: "",
          nearbyServices: [],
          nearbyCategories: [],
        };

        try {
          const detailsRes = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}`,
            {
              headers: {
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask":
                  "location,addressComponents,formattedAddress",
              },
            },
          );
          const details = await detailsRes.json();

          if (!detailsRes.ok || !details.location) {
            return base;
          }

          const { latitude, longitude } = details.location;
          base.formatted_address =
            details.formattedAddress || base.formatted_address;

          const components = details.addressComponents || [];
          const cityComp = components.find((c) => c.types.includes("locality"));
          const countyComp = components.find(
            (c) =>
              c.types.includes("administrative_area_level_1") ||
              c.types.includes("administrative_area_level_2"),
          );
          if (cityComp) base.city = cityComp.longText;
          if (countyComp) base.county = countyComp.longText;

          // ── Nearby POIs within 3km ──
          const nearbyRes = await fetch(
            "https://places.googleapis.com/v1/places:searchNearby",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask":
                  "places.displayName,places.types,places.primaryType",
              },
              body: JSON.stringify({
                maxResultCount: 20,
                locationRestriction: {
                  circle: {
                    center: { latitude, longitude },
                    radius: 3000,
                  },
                },
              }),
            },
          );
          const nearbyData = await nearbyRes.json();
          const places = nearbyData.places || [];

          base.nearbyServices = places
            .map((p) => p.displayName?.text)
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 12);

          base.nearbyCategories = places
            .map((p) => TYPE_TO_CHIP[p.primaryType])
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i);

          return base;
        } catch (innerErr) {
          logger.error(
            "[move_in/get_place_suggestions] enrich error: " + innerErr.message,
          );
          return base;
        }
      }),
    );

    return reply.code(200).send({ success: true, data: enriched });
  } catch (err) {
    logger.error("[move_in/get_place_suggestions] " + err.message);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_place_suggestions;
