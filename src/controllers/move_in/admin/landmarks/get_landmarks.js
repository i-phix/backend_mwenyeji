const db = require('payservedb');


const get_landmarks = async (request, reply) => {
    try {
        const { search, category, status } = request.query;

        const filter = {};

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { name: regex },
                { area: regex },
                { city: regex },
                { address: regex },
            ];
        }

        if (category) filter.category = category;

        if (status === 'active') filter.isActive = { $ne: false };
        else if (status === 'inactive') filter.isActive = false;

        const data = await db.moveIn.MoveInPOI.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        return reply.code(200).send({ success: true, data: { data } });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_landmarks;
