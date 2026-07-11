const payservedb = require('payservedb');
const jwt = require('jsonwebtoken');

const check_jwt_expiration = async (request, reply) => {
    try {
        const { token } = request.body; 
       
        
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Get the current time in seconds since epoch
        const currentTime = Math.floor(Date.now() / 1000);

        // Compare the current time with the expiration time (exp)
        return currentTime > payload.exp;
    } catch (err) {
        console.error('Error while checking token expiration:', err);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
};

module.exports = check_jwt_expiration;
