const authenticateJWT = require("../../middlewares/jwt_authentication");
const {
  getCustomerUserById,
  getUserById,
  getUsersWhoAreStaff,
} = require("./user/get");

async function registerRoutes(fastify) {
  const usersBaseRoute = "/api/universal/users";
  const jwt = { prehandler: authenticateJWT };

  fastify.get(`${usersBaseRoute}/customer/get/:id`, getCustomerUserById);
  fastify.get(`${usersBaseRoute}/get/:id`, getUserById);
  fastify.get(`${usersBaseRoute}/get/staff`, getUsersWhoAreStaff);
}

module.exports = {
  registerRoutes,
};
