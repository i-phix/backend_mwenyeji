const payservedb = require('payservedb');

const get_rfq = async (request, reply) => {
    try {
        const { facilityId, rfqId } = request.params;
        
        // Basic validation
        if (!rfqId) {
            return reply.code(400).send({
                success: false,
                error: 'RFQ ID is required'
            });
        }
        
        // Find the RFQ by ID in the main database
        const rfq = await payservedb.RFQDetails.findById(rfqId);
                
        if (!rfq) {
            return reply.code(404).send({
                success: false,
                error: 'RFQ not found'
            });
        }
        
        // Verify the RFQ belongs to the specified facility
        if (rfq.facilityId.toString() !== facilityId) {
            return reply.code(403).send({
                success: false,
                error: 'RFQ does not belong to the specified facility'
            });
        }

        // Get supplier details for all supplier IDs in the RFQ
        const suppliersInfo = [];
        
        if (rfq.suppliers && rfq.suppliers.length > 0) {
            for (const supplier of rfq.suppliers) {
                try {
                    // Query the main database for supplier details
                    const supplierData = await payservedb.Supplier.findById(supplier.supplierId);
                    if (supplierData) {
                        suppliersInfo.push({
                            _id: supplierData._id,
                            name: supplierData.name,
                            email: supplierData.email,
                            phone: supplierData.phone,
                        });
                    }
                } catch (supplierErr) {
                    console.error(`Error fetching supplier ${supplier.supplierId}:`, supplierErr);
                }
            }
        }

        // Convert RFQ to a plain object and add supplier details
        const rfqWithSuppliers = rfq.toObject();
        rfqWithSuppliers.suppliersInfo = suppliersInfo;
        
        return reply.code(200).send({
            success: true,
            message: 'RFQ retrieved successfully',
            data: rfqWithSuppliers
        });
    } catch (err) {
        console.error('Error in getting RFQ:', err);
        return reply.code(400).send({ 
            success: false,
            error: err.message || 'An error occurred while retrieving the RFQ'
        });
    }
};

module.exports = get_rfq;