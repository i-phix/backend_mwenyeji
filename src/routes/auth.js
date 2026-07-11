const authenticateJWT = require('../middlewares/jwt_authentication')
const check_email_and_password = require("../controllers/authentication/check_email_and_password");
const forgot_password = require("../controllers/authentication/forgot_password");
const login = require("../controllers/authentication/login");
const otp = require("../controllers/authentication/otp");
const refreshToken = require("../controllers/authentication/refresh_token");
const reset_password = require("../controllers/authentication/reset_password");
const resend_code = require('../controllers/authentication/resend_code')
const verify_otp = require('../controllers/authentication/verify_otp')
const check_jwt_expiration = require('../controllers/authentication/check_jwt_expiration');
const check_authorization = require('../controllers/authentication/check_authorization');
// const register_landlord = require('../controllers/authentication/landlord/register_landlord');

async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT }

    const baseRoute = '/api/auth'
    fastify.get(baseRoute + '/check_authorization',jwt,check_authorization)
    // fastify.post(baseRoute + '/landlord/register', register_landlord);
    fastify.post(baseRoute + '/check_email_and_password', check_email_and_password);
    fastify.post(baseRoute + '/login', login); // DONE
    fastify.post(baseRoute + '/check_jwt_expiration', check_jwt_expiration)
    fastify.post(baseRoute + '/otp', otp);
    fastify.post(baseRoute + '/forgot_password', forgot_password)
    fastify.post(baseRoute + '/resend_code', resend_code);
    fastify.post(baseRoute + '/verify_otp', verify_otp)
    fastify.post(baseRoute + '/reset_password/:id', reset_password)
    fastify.post(baseRoute + '/refresh_token/:id', refreshToken);

}

module.exports = { registerRoutes };