const cron = require('node-cron');
const db = require('payservedb');
const logger = require('../../config/winston');

// ── Job 1: Expire overdue reservation holds ────────────────────────────────
// Runs every hour. Any reservation in 'pending' status past its expiresAt is
// automatically transitioned to 'expired' so the unit can be offered to others.
async function expireReservations() {
    try {
        const result = await db.moveIn.MoveInReservation.updateMany(
            { status: 'pending', expiresAt: { $lt: new Date() } },
            { $set: { status: 'expired' } },
        );
        if (result.modifiedCount > 0) {
            logger.info(`[move_in_cleanup] Expired ${result.modifiedCount} overdue reservation(s).`);
        }
    } catch (err) {
        logger.error('[move_in_cleanup/expire_reservations] ' + err.message);
    }
}

// ── Job 2: Clean up past viewing slots ────────────────────────────────────
// Runs once daily. Slots whose scheduledAt is more than 7 days in the past
// and have no bookings are removed to keep the collection lean.
async function cleanOldSlots() {
    try {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const result = await db.moveIn.MoveInViewingSlot.deleteMany({
            date:         { $lt: cutoff },
            bookedCount:  0,
            isAvailable:  true,
        });
        if (result.deletedCount > 0) {
            logger.info(`[move_in_cleanup] Removed ${result.deletedCount} old viewing slot(s).`);
        }
    } catch (err) {
        logger.error('[move_in_cleanup/clean_old_slots] ' + err.message);
    }
}

function startCron() {
    // Every hour at minute 0
    cron.schedule('0 * * * *', expireReservations, { timezone: 'Africa/Nairobi' });

    // Every day at 03:00
    cron.schedule('0 3 * * *', cleanOldSlots, { timezone: 'Africa/Nairobi' });

    logger.info('[move_in_cleanup] Cleanup cron jobs registered.');
}

module.exports = { startCron };
