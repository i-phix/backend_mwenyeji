const savePreferences = require("../controllers/preferences/save_preferences");
const getPlaceSuggestions = require("../controllers/places/get_place_suggestions");

// Both public — the preference wizard and place autocomplete run on the
// unauthenticated /preferences page.
async function preferencesRoutes(fastify) {
  fastify.post("/api/move_in/preferences/save", savePreferences);
  fastify.get("/api/move_in/places/suggestions", getPlaceSuggestions);
}

module.exports = preferencesRoutes;
