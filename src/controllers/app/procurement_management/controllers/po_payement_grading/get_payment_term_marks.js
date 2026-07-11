const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_payment_term_marks = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.query.facilityId;
        
        const paymentTermMarkModel = await getModel('PaymentTermMark', payservedb.PaymentTermMark.schema, facilityId);

        // Get pagination parameters
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get search parameter
        const search = request.query.search || '';

        // Build query
        let query = {};
        if (search) {
            query.paymentTerm = { $regex: search, $options: 'i' };
        }

        // Get payment term marks with pagination
        const [paymentTermMarks, totalCount] = await Promise.all([
            paymentTermMarkModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            paymentTermMarkModel.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return reply.code(200).send({
            success: true,
            message: 'Payment term marks retrieved successfully',
            data: {
                paymentTermMarks,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: totalCount,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        });
    } catch (err) {
        console.error('Error in getting payment term marks:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while getting payment term marks'
        });
    }
};

module.exports = get_payment_term_marks;