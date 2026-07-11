const db = require('payservedb');
const logger = require('../../../../config/winston');

function handoverStatus(reservation) {
    if (reservation.status === 'confirmed') return 'scheduled';
    if (reservation.status === 'cancelled' || reservation.status === 'expired') return 'pending';
    return reservation.status || 'pending';
}

// GET /api/move_in/handovers
// Derived from reservations so the handover page has reliable data before a
// separate handover workflow model is added.
const get_handovers = async (request, reply) => {
    try {
        const { userId } = request.user;

        const [reservations, applications] = await Promise.all([
            db.moveIn.MoveInReservation.find({ tenantId: userId }).sort({ desiredMoveInDate: 1, createdAt: -1 }).lean(),
            db.moveIn.MoveInApplication.find({ tenantId: userId }).sort({ desiredMoveInDate: 1, createdAt: -1 }).lean(),
        ]);

        const handovers = reservations.map((reservation) => ({
            id: reservation._id,
            tenantName: reservation.tenantName,
            unitName: reservation.unitName,
            scheduledDate: reservation.desiredMoveInDate || reservation.updatedAt || reservation.createdAt,
            status: handoverStatus(reservation),
            assignedTo: reservation.landlordId ? 'Landlord' : 'Move-In Team',
        }));

        const reservationUnitIds = new Set(reservations.map((reservation) => String(reservation.unitId)));
        applications
            .filter((application) => !reservationUnitIds.has(String(application.unitId)))
            .forEach((application) => {
                handovers.push({
                    id: application._id,
                    tenantName: application.tenantName,
                    unitName: application.unitName,
                    scheduledDate: application.desiredMoveInDate || application.updatedAt || application.createdAt,
                    status: application.status === 'approved' ? 'scheduled' : 'pending',
                    assignedTo: application.landlordId ? 'Landlord' : 'Move-In Team',
                });
            });

        handovers.sort((a, b) => new Date(a.scheduledDate || 0) - new Date(b.scheduledDate || 0));

        return reply.code(200).send({ success: true, data: handovers });
    } catch (err) {
        logger.error('[move_in/handovers/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_handovers;
