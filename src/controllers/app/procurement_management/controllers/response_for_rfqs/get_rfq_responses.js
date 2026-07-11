const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_rfq_responses = async (request, reply) => {
  try {
    const facilityId = request.params.facilityId;
    const rfqId = request.query.rfqId;
    
    if (!facilityId || !rfqId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID and RFQ ID are required'
      });
    }
    
    // Verify RFQ exists
    const rfqExists = await payservedb.RFQDetails.exists({
      _id: rfqId,
      facilityId
    });
    
    if (!rfqExists) {
      return reply.code(404).send({
        success: false,
        error: 'RFQ not found for this facility'
      });
    }
    
    // Fetch RFQ responses
    const responses = await payservedb.RFQResponse.find({
      rfqId,
      facilityId
    }).lean().exec();
    
    // Get the Supplier model for this specific facility
    const SupplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);
    
    // Process all responses to include supplier details
    const enhancedResponses = await Promise.all(
      responses.map(async (response) => {
        let supplierInfo = null;
        
        if (response.supplierId) {
          try {
            // Find the supplier using userId from the facility-specific supplier collection
            const supplier = await SupplierModel.findOne({ userId: response.supplierId });
            
            if (supplier) {
              supplierInfo = {
                name: supplier.name,
                email: supplier.email,
                phone: supplier.phone,
                contactPerson: supplier.contactPerson?.name || '',
                department: supplier.department?.name || ''
              };
            }
          } catch (err) {
            console.error(`Error fetching supplier for response ${response._id}:`, err);
          }
        }
        
        return {
          ...response,
          supplierDetails: supplierInfo
        };
      })
    );
    
    return reply.code(200).send({
      success: true,
      data: enhancedResponses
    });
  } catch (err) {
    console.error('Error in get_rfq_responses:', err);
    return reply.code(500).send({
      success: false,
      error: err.message || 'An error occurred while fetching RFQ responses'
    });
  }
};

module.exports = get_rfq_responses;