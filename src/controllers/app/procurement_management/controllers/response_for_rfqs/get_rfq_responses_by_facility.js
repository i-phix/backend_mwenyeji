const payservedb = require('payservedb');
const mongoose = require('mongoose');

const get_rfq_responses_by_facility = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { status, page = 1, limit = 10 } = request.query;

        // Validate facility ID
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                error: 'Valid facility ID is required'
            });
        }

        // Build query
        const query = { facilityId };
        
        // Add status filter if provided
        if (status && ['open', 'closed', 'awarded', 'canceled'].includes(status)) {
            query.status = status;
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count for pagination
        const totalCount = await payservedb.RFQResponse.countDocuments(query);
        
        // Get paginated results with populated data
        const responses = await payservedb.RFQResponse.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('rfqId', 'name rfqNumber startDate closingDate currency status')
            .populate('suppliers.supplierId', 'name email phone')
            .lean();

        // Add participation rate for each response
        const enhancedResponses = responses.map(response => {
            const totalSuppliers = response.suppliers.length;
            const respondedSuppliers = response.suppliers.filter(s => s.quotationSubmitted).length;
            const participationRate = totalSuppliers ? (respondedSuppliers / totalSuppliers) * 100 : 0;
            
            return {
                ...response,
                participationRate: parseFloat(participationRate.toFixed(2))
            };
        });

        return reply.code(200).send({
            success: true,
            data: enhancedResponses,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error in getting RFQ responses by facility:', err);
        return reply.code(400).send({
            success: false,
            error: err.message || 'An error occurred while fetching RFQ responses'
        });
    }
};

module.exports = get_rfq_responses_by_facility;