const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_by_id = async (request, reply) => {
    try {
        const { rfqId } = request.params;
        
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

        // Get the facilityId from the RFQ
        const facilityId = rfq.facilityId;
        
        // Get supplier details for all supplier IDs in the RFQ
        const suppliersInfo = [];
        
        if (rfq.suppliers && rfq.suppliers.length > 0) {
            // Get the Supplier model for this specific facility
            const SupplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);
            
            for (const supplier of rfq.suppliers) {
                try {
                    // Query the facility-specific collection for supplier details
                    // Assuming supplier.supplierId is the userId in the facility-specific collection
                    const supplierData = await SupplierModel.findOne({ userId: supplier.supplierId });
                    
                    if (supplierData) {
                        suppliersInfo.push({
                            _id: supplierData._id,
                            name: supplierData.name,
                            email: supplierData.email,
                            phone: supplierData.phone,
                            contactPerson: supplierData.contactPerson?.name || '',
                            department: supplierData.department?.name || ''
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
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while retrieving the RFQ'
        });
    }
};

module.exports = get_by_id;