const db = require('payservedb');


const delete_landmark = async (request, reply) => {
    try {
        const { landmarkId } = request.params;

        const doc = await db.moveIn.MoveInPOI.findByIdAndUpdate(
            landmarkId,
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!doc) return reply.code(404).send({ success: false, error: 'Landmark not found.' });

        return reply.code(200).send({ success: true, data: doc });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_landmark;
