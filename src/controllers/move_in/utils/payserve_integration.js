const db = require('payservedb');
const logger = require('../../../../config/winston');

// PayServe integration is intentionally explicit and non-invasive.
// Nothing in the normal standalone Move-In flow calls this automatically.
// Future admin sync endpoints should call this only for deal.source === 'payserve'.
async function preparePayServeSync(dealId) {
    const deal = await db.moveIn.MoveInDeal.findById(dealId).lean();
    if (!deal) {
        const error = new Error('Move-In deal not found.');
        error.statusCode = 404;
        throw error;
    }

    if (deal.source !== 'payserve') {
        return {
            shouldSync: false,
            reason: 'Standalone Move-In deal. No PayServe property write required.',
            deal,
        };
    }

    if (!deal.sourceFacilityId || !deal.sourceUnitId) {
        const error = new Error('PayServe-backed deal is missing source facility or unit.');
        error.statusCode = 400;
        throw error;
    }

    return {
        shouldSync: true,
        deal,
        sourceFacilityId: deal.sourceFacilityId,
        sourceUnitId: deal.sourceUnitId,
        tenant: {
            id: deal.tenantId,
            name: deal.tenantName,
            email: deal.tenantEmail,
            phone: deal.tenantPhone,
        },
    };
}

async function markPayServeSyncFailed(dealId, error) {
    await db.moveIn.MoveInDeal.updateOne(
        { _id: dealId },
        {
            $set: {
                'payserveSync.status': 'failed',
                'payserveSync.lastError': error?.message || String(error || 'Unknown error'),
            },
        }
    ).catch((e) => logger.warn('[move_in/payserve_integration] failed to mark sync failure: ' + e.message));
}

module.exports = {
    preparePayServeSync,
    markPayServeSyncFailed,
};
