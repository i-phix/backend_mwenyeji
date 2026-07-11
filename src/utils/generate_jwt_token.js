const jwt = require('jsonwebtoken');
const generateRefreshToken = require('./generate_jwt_refresh_token');
const logger = require('../../config/winston');
const generate_jwt_token = async (payload, userType) => {
  try {
    let expiresIn;
    const type = Array.isArray(userType) ? userType[0] : userType;

    switch (type) {
      case 'Company':
      case 'Project Manager':
      case 'Universal':
      case 'Core':
      case 'Landlord':
      case 'Supplier':
        expiresIn = '12h';
        break;

      case 'Resident':
        expiresIn = '48h';
        break;

      default:
        expiresIn = '12h';
    }


    const secret = process.env.jwtSecret;
    const authToken = jwt.sign(payload, secret, { expiresIn: expiresIn });
    const refreshToken = await generateRefreshToken(payload.userId)
    logger.info('Successfully generated authToken & refreshToken')
    return {
      authToken,
      refreshToken
    }
  }
  catch (err) {
    logger.error(`Failed to generate auth and refresh token: ${err.message}`);
    return;
  }

}
module.exports = generate_jwt_token