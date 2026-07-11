const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/core/move_in/customers
const get_customers = async (request, reply) => {
    try {
        const { status = 'All', search = '', page = 1, limit = 20 } = request.query;

        const filter = {};
        if (status !== 'All') {
            filter.isEnabled = status === 'active';
        }

        // Customers are MoveInUsers in payserve_movein (separate from payserve_property Users)
        let customers = await db.moveIn.MoveInUser.find(filter)
            .select('fullName email phoneNumber isEnabled createdAt')
            .sort({ createdAt: -1 })
            .lean();

        if (search) {
            const q = search.toLowerCase();
            customers = customers.filter((c) =>
                (c.fullName || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.phoneNumber || '').includes(q)
            );
        }

        // Attach application count per customer
        const customerIds = customers.map((c) => c._id);
        const counts = await db.moveIn.MoveInApplication.aggregate([
            { $match: { tenantId: { $in: customerIds } } },
            { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        ]);
        const countMap = {};
        counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

        const enriched = customers.map((c) => ({
            ...c,
            name: c.fullName,
            phone: c.phoneNumber,
            status: c.isEnabled ? 'active' : 'suspended',
            applicationCount: countMap[c._id.toString()] || 0,
        }));

        const total = enriched.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = enriched.slice(skip, skip + Number(limit));

        return reply.code(200).send({
            success: true,
            data: paginated,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[core/move_in/customers/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_customers;
