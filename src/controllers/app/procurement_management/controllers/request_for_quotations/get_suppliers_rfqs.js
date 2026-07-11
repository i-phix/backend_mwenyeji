const payservedb = require('payservedb');

const get_supplier_rfqs = async (request, reply) => {
    try {
        const { supplierId } = request.params;
        const { page = 1, limit = 10 } = request.query;
        
        // Correct query to find RFQs where the supplier ID is in the suppliers array
        const query = {
            'suppliers': supplierId
        };
        
        // Calculate pagination
        const skip = (page - 1) * limit;
        
        // Get total count for pagination
        const totalCount = await payservedb.RFQDetails.countDocuments(query);
        
        // Fetch RFQs with pagination directly from the main database
        let rfqs = await payservedb.RFQDetails
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        // Now for each RFQ, if it has a facilityId, fetch the facility name
        const enrichedRfqs = await Promise.all(rfqs.map(async (rfq) => {
            const rfqObj = rfq.toObject ? rfq.toObject() : rfq;
            
            if (rfqObj.facilityId) {
                try {
                    // Get the facility details from the database
                    const facility = await payservedb.Facility.findById(rfqObj.facilityId);
                    
                    // Add the facility name to the RFQ object
                    if (facility) {
                        rfqObj.facilityName = facility.name;
                    }
                } catch (facilityErr) {
                    console.error(`Error fetching facility for RFQ ${rfqObj._id}:`, facilityErr);
                    // If there's an error, we'll just continue without the facility name
                }
            }
            
            return rfqObj;
        }));
        
        return reply.code(200).send({
            success: true,
            message: 'Supplier RFQs retrieved successfully',
            data: enrichedRfqs,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error('Error in getting supplier RFQs:', err);
        return reply.code(400).send({
            success: false,
            error: err.message || 'An error occurred while retrieving supplier RFQs'
        });
    }
};

module.exports = get_supplier_rfqs;