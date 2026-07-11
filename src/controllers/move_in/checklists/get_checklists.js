const db = require('payservedb');
const logger = require('../../../../config/winston');

function checklistStatus(reservation) {
    if (reservation.status === 'confirmed') return 'in_progress';
    if (reservation.status === 'cancelled' || reservation.status === 'expired') return 'pending';
    return reservation.status || 'pending';
}

// GET /api/move_in/checklists
// Uses reservation/application progress as the source of truth until dedicated
// checklist records are introduced.
const get_checklists = async (request, reply) => {
    try {
        const { userId } = request.user;

        const [reservations, applications] = await Promise.all([
            db.moveIn.MoveInReservation.find({ tenantId: userId }).sort({ createdAt: -1 }).lean(),
            db.moveIn.MoveInApplication.find({ tenantId: userId }).sort({ createdAt: -1 }).lean(),
        ]);

        const checklists = reservations.map((reservation) => ({
            id: reservation._id,
            tenantName: reservation.tenantName,
            unitName: reservation.unitName,
            status: checklistStatus(reservation),
            completionDate: reservation.status === 'confirmed' ? reservation.updatedAt : null,
            createdAt: reservation.createdAt,
        }));

        const reservationUnitIds = new Set(reservations.map((reservation) => String(reservation.unitId)));
        applications
            .filter((application) => !reservationUnitIds.has(String(application.unitId)))
            .forEach((application) => {
                checklists.push({
                    id: application._id,
                    tenantName: application.tenantName,
                    unitName: application.unitName,
                    status: application.status === 'completed' ? 'completed' : application.status || 'pending',
                    completionDate: application.status === 'completed' ? application.updatedAt : null,
                    createdAt: application.createdAt,
                });
            });

        checklists.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        return reply.code(200).send({ success: true, data: checklists });
    } catch (err) {
        logger.error('[move_in/checklists/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_checklists;
