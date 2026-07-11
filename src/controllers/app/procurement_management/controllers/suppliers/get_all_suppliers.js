const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_all_suppliers = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { status, page = 1, limit = 10, name } = request.query;
        
        const supplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);
        
        // Build query filters
        const filter = {};
        
        // Add status filter if provided
        if (status && ['active', 'inactive', 'blacklisted'].includes(status)) {
            filter.status = status;
        }
        
        // Add name search if provided
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Query suppliers with pagination
        const suppliers = await supplierModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        // Get total count for pagination info
        const totalCount = await supplierModel.countDocuments(filter);
        
        return reply.code(200).send({
            message: 'Suppliers retrieved successfully',
            data: suppliers,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error in fetching suppliers:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_all_suppliers;