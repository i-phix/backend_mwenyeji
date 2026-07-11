// Middleware: ensures the caller is NOT a Move-In tenant or landlord.
// Any valid PayServe JWT issued by the main platform (core_main / admin panel) is accepted.
const require_movein_admin = (request, reply, done) => {
    const t = request.user?.type;
    if (t === 'MoveInUser' || t === 'MoveInLandlordUser') {
        return reply.code(403).send({ error: 'Forbidden: admin access required.' });
    }
    done();
};

module.exports = require_movein_admin;
