const authenticateJWT = require("../../../../../middlewares/jwt_authentication");
const add_facility_payment_details = require("../controllers/add_facility_payment_details");
const update_facility_payment_details = require("../controllers/update_facility_payment_details");
const get_facility_payment_details = require("../controllers/get_facility_payment_details");
const get_facility_payment_detail_by_id = require("../controllers/get_facility_payment_detail_by_id");

const facilityPaymentBaseRoute = "/api/core/facility_payment_details";

async function registerPaymentRoutes(fastify) {
  const jwt = { preHandler: authenticateJWT };

  fastify.post(
    facilityPaymentBaseRoute + "/add_payment_details",
    jwt,
    add_facility_payment_details,
  );

  fastify.put(
    facilityPaymentBaseRoute + "/update_payment_details",
    jwt,
    update_facility_payment_details,
  );

  fastify.get(
    facilityPaymentBaseRoute + "/get_facility_payment_details/:id",
    jwt,
    get_facility_payment_details,
  );

  fastify.get(
    facilityPaymentBaseRoute + "/get_payment_detail_by_id/:facilityId/:id",
    jwt,
    get_facility_payment_detail_by_id,
  );
}

module.exports = { registerPaymentRoutes };
