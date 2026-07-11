const db = require('payservedb');

// Middleware: verifies that the authenticated landlord has been assigned the Move-In module.
// Must run after authenticateJWT (request.user is already populated).
// Usage: { preHandler: [authenticateJWT, requireMoveInAccess] }
const requireMoveInAccess = async (request, reply) => {
    const { userId } = request.user;

    const record = await db.moveIn.MoveInLandlord.findOne({ landlordId: userId, isEnabled: true }).lean();
    if (!record) {
        return reply.code(403).send({ error: 'Move-In module access has not been granted for this account.' });
    }
};

module.exports = requireMoveInAccess;
