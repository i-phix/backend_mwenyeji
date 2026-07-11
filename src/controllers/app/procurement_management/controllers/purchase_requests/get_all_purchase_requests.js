const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_all_purchase_requests = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { status, department, page = 1, limit = 10, search } = request.query;

        const purchaseRequestModel = await getModel('PurchaseRequest', payservedb.PurchaseRequest.schema, facilityId);

        // Build query
        const query = { facilityId };

        // Add filters if they exist
        if (status) {
            query.status = status;
        }

        if (department) {
            query.department = department;
        }

        // Add search capability - modified to search in items array
        if (search) {
            query.$or = [
                { 'items.itemDescription': { $regex: search, $options: 'i' } },
                { irfNumber: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalCount = await purchaseRequestModel.countDocuments(query);

        // Fetch purchase requests with pagination
        const purchaseRequests = await purchaseRequestModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        return reply.code(200).send({
            message: 'Purchase requests retrieved successfully',
            data: purchaseRequests,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error('Error in getting all purchase requests:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_all_purchase_requests;