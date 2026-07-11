const db = require('payservedb');
const logger = require('../../../../config/winston');
const { notifyLandlord } = require('../utils/notifications');

// PUT /api/move_in/admin/commissions/:commissionId
// Body: { status, paymentRef?, invoiceRef?, notes? }
const update_commission = async (request, reply) => {
    try {
        const { commissionId } = request.params;
        const { status, paymentRef, invoiceRef, notes } = request.body || {};

        if (!['due', 'invoiced', 'paid', 'waived', 'refunded', 'disputed', 'cancelled'].includes(status)) {
            return reply.code(400).send({ error: 'Invalid commission status.' });
        }

        const commission = await db.moveIn.MoveInCommission.findById(commissionId);
        if (!commission) return reply.code(404).send({ error: 'Commission not found.' });

        commission.status = status;
        if (paymentRef !== undefined) commission.paymentRef = paymentRef || null;
        if (invoiceRef !== undefined) commission.invoiceRef = invoiceRef || null;
        if (notes !== undefined) commission.notes = notes || null;
        if (status === 'paid' && !commission.paidAt) commission.paidAt = new Date();
        await commission.save();

        const dealCommissionStatus = status === 'cancelled' ? 'not_due' : status;
        await db.moveIn.MoveInDeal.updateOne(
            { _id: commission.dealId },
            { $set: { commissionStatus: dealCommissionStatus } }
        );

        await db.moveIn.MoveInPayment.updateOne(
            { commissionId: commission._id, type: 'commission' },
            {
                $set: {
                    status: status === 'paid' ? 'paid' : (['waived', 'cancelled', 'disputed', 'refunded'].includes(status) ? status : 'pending'),
                    reference: paymentRef || commission.paymentRef || null,
                    paidAt: status === 'paid' ? commission.paidAt : null,
                    notes: notes || commission.notes || null,
                },
            }
        );

        await db.moveIn.MoveInAuditLog.create({
            adminId: request.user?.userId || null,
            action: 'commission_updated',
            resourceType: 'payment',
            resourceId: commission._id,
            details: `Commission ${commission._id} marked ${status}.`,
            ipAddress: request.ip || null,
        }).catch((e) => logger.warn('[move_in/admin/update_commission/audit] ' + e.message));

        await notifyLandlord({
            landlordId: commission.landlordId,
            title: 'Commission Updated',
            body: `Commission for ${commission.unitName || 'a rented unit'} is now ${status}.`,
            type: 'commission',
            relatedId: commission._id,
            emailSubject: `Move-In commission ${status}`,
            emailText: `Hi,\n\nThe commission for ${commission.unitName || 'a rented unit'} has been marked ${status}.${paymentRef ? `\nPayment reference: ${paymentRef}` : ''}${invoiceRef ? `\nInvoice reference: ${invoiceRef}` : ''}${notes ? `\n\nNotes: ${notes}` : ''}\n\nMove-In by PayServe`,
        });

        return reply.code(200).send({ success: true, data: commission });
    } catch (err) {
        logger.error('[move_in/admin/update_commission] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_commission;
