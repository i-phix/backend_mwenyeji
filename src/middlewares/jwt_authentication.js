// authMiddleware.js

const jwt = require('jsonwebtoken');


const authenticateJWT = (request, reply, done) => {
    const token = request.headers['authorization'];
    const JWT_SECRET = process.env.jwtSecret
    if (!token) {
        return reply.code(401).send({ error: "Unauthorized" });
    }
    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        request.user = decoded;
        done();
    });
};

module.exports = authenticateJWT;


