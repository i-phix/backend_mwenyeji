const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../../utils/getModel');

const get_delivery_time_marks = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.query.facilityId;
        
        const deliveryTimeMarkModel = await getModel('DeliveryTimeMark', payservedb.DeliveryTimeMark.schema, facilityId);

        // Get pagination parameters
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get search parameter (for delivery days)
        const search = request.query.search || '';

        // Build query
        let query = {};
        if (search) {
            // If search is a number, search by deliveryDays
            if (!isNaN(search)) {
                query.deliveryDays = parseInt(search);
            }
        }

        // Get delivery time marks with pagination
        const [deliveryTimeMarks, totalCount] = await Promise.all([
            deliveryTimeMarkModel.find(query)
                .sort({ deliveryDays: 1 }) 
                .skip(skip)
                .limit(limit)
                .lean(),
            deliveryTimeMarkModel.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return reply.code(200).send({
            success: true,
            message: 'Delivery time marks retrieved successfully',
            data: {
                deliveryTimeMarks,
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
        console.error('Error in getting delivery time marks:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while getting delivery time marks'
        });
    }
};

module.exports = get_delivery_time_marks;
