const getListings = require("../controllers/listings/get_listings");
const getListing = require("../controllers/listings/get_listing");
const getListingLocations = require("../controllers/listings/get_listing_locations");
const getUnitFees = require("../controllers/listings/get_unit_fees");

async function listingsRoutes(fastify) {
  fastify.get("/api/move_in/listings", getListings);
  fastify.get("/api/move_in/listings/locations", getListingLocations);
  fastify.get("/api/move_in/listings/:unitId/fees", getUnitFees);
  fastify.get("/api/move_in/listings/:id", getListing);
}

module.exports = listingsRoutes;
