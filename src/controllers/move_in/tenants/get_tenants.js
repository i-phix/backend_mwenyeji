const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/tenants
// Tenant workspace endpoint: returns the logged-in tenant intake record with
// the latest move-in context derived from applications/reservations.
const get_tenants = async (request, reply) => {
    try {
        const { userId } = request.user;

        const [tenant, latestReservation, latestApplication] = await Promise.all([
            db.moveIn.MoveInUser.findById(userId).select('-password').lean(),
            db.moveIn.MoveInReservation.findOne({ tenantId: userId }).sort({ createdAt: -1 }).lean(),
            db.moveIn.MoveInApplication.findOne({ tenantId: userId }).sort({ createdAt: -1 }).lean(),
        ]);

        if (!tenant) return reply.code(404).send({ error: 'Tenant profile not found.' });

        const source = latestReservation || latestApplication || {};
        const status = latestReservation?.status === 'confirmed'
            ? 'active'
            : latestReservation?.status || latestApplication?.status || 'pending';

        return reply.code(200).send({
            success: true,
            data: [{
                id: tenant._id,
                name: tenant.fullName,
                email: tenant.email,
                phone: tenant.phoneNumber,
                status,
                unitName: source.unitName || null,
                moveInDate: source.desiredMoveInDate || null,
                createdAt: tenant.createdAt,
            }],
        });
    } catch (err) {
        logger.error('[move_in/tenants/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_tenants;
