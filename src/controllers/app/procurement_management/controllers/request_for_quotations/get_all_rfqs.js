const payservedb = require('payservedb');

const get_all_rfqs = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { page = 1, limit = 10 } = request.query;

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Basic query - just filter by facilityId
        const query = { facilityId };

        // Calculate pagination
        const skip = (page - 1) * limit;

        const totalCount = await payservedb.RFQDetails.countDocuments(query);

        const rfqs = await payservedb.RFQDetails
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        return reply.code(200).send({
            success: true,
            message: 'RFQs retrieved successfully',
            data: rfqs,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error('Error in getting all RFQs:', err);
        return reply.code(400).send({ 
            success: false,
            error: err.message || 'An error occurred while retrieving RFQs'
        });
    }
};

module.exports = get_all_rfqs;