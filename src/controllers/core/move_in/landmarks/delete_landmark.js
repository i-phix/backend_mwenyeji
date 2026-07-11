const db = require('payservedb');
const mongoose = require('mongoose');
const logger = require('../../../../../config/winston');

const getPOI = () => {
    const conn = db.moveInConnection;
    if (!conn) throw new Error('Move-In DB connection not ready.');
    if (conn.models['MoveInPOI']) return conn.models['MoveInPOI'];
    return conn.model('MoveInPOI', new mongoose.Schema({}, { strict: false, timestamps: true }), 'moveinpois');
};

const delete_landmark = async (request, reply) => {
    try {
        const { landmarkId } = request.params;
        const doc = await getPOI().findByIdAndUpdate(landmarkId, { $set: { isActive: false } }, { new: true }).lean();
        if (!doc) return reply.code(404).send({ success: false, error: 'Landmark not found.' });
        return reply.code(200).send({ success: true, data: doc });
    } catch (err) {
        logger.error('[core/move_in/landmarks/delete] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_landmark;
