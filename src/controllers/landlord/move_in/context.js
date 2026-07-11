const db = require('payservedb');

const clean = (value) => String(value || '').trim();

async function getPayServeLandlord(userId) {
    const landlord = await db.User.findById(userId).select('email fullName phoneNumber isEnabled type').lean();
    if (!landlord || landlord.type !== 'Landlord') {
        const error = new Error('Access denied.');
        error.statusCode = 403;
        throw error;
    }
    if (landlord.isEnabled === false) {
        const error = new Error('Landlord account is inactive.');
        error.statusCode = 403;
        throw error;
    }
    return landlord;
}

async function ensureMoveInLandlordForPayServeUser(userId) {
    const payserveLandlord = await getPayServeLandlord(userId);
    const email = clean(payserveLandlord.email).toLowerCase();
    if (!email) {
        const error = new Error('Landlord email is required for Move-In linking.');
        error.statusCode = 400;
        throw error;
    }

    let moveInLandlord = await db.moveIn.MoveInLandlordUser.findOne({
        $or: [{ payserveUserId: userId }, { email }],
    });

    if (!moveInLandlord) {
        moveInLandlord = await db.moveIn.MoveInLandlordUser.create({
            fullName: payserveLandlord.fullName || email,
            email,
            phoneNumber: payserveLandlord.phoneNumber || `PS-${String(userId).slice(-10)}`,
            password: 'MANAGED_BY_PAYSERVE',
            companyName: null,
            isEnabled: true,
            payserveUserId: userId,
        });
    } else if (!moveInLandlord.payserveUserId) {
        moveInLandlord.payserveUserId = userId;
        await moveInLandlord.save();
    }

    if (!moveInLandlord.isEnabled) {
        const error = new Error('Move-In landlord account is suspended.');
        error.statusCode = 403;
        throw error;
    }

    return { payserveLandlord, moveInLandlord };
}

function landlordRecordFilter({ payserveUserId, moveInLandlordId }) {
    return { landlordId: { $in: [payserveUserId, moveInLandlordId].filter(Boolean) } };
}

function sendError(reply, err) {
    return reply.code(err.statusCode || 502).send({ error: err.message });
}

module.exports = {
    ensureMoveInLandlordForPayServeUser,
    getPayServeLandlord,
    landlordRecordFilter,
    sendError,
};
