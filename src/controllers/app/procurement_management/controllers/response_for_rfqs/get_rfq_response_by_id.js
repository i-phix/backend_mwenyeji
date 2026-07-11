const payservedb = require('payservedb');
const mongoose = require('mongoose');

const get_rfq_response_by_id = async (request, reply) => {
    try {
        const { responseId } = request.params;

        // Validate response ID
        if (!responseId || !mongoose.Types.ObjectId.isValid(responseId)) {
            return reply.code(400).send({
                success: false,
                error: 'Valid response ID is required'
            });
        }

        // Fetch the RFQ response with populated data
        const response = await payservedb.RFQResponse.findById(responseId)
            .populate('rfqId', 'name rfqNumber startDate closingDate currency status items category')
            .populate('facilityId', 'name email phone address')
            .populate('suppliers.supplierId', 'name email phone')
            .populate('awardDetails.awardedSupplierId', 'name email phone')
            .lean();

        if (!response) {
            return reply.code(404).send({
                success: false,
                error: 'RFQ response not found'
            });
        }

        // Calculate participation rate
        const totalSuppliers = response.suppliers.length;
        const respondedSuppliers = response.suppliers.filter(s => s.quotationSubmitted).length;
        const participationRate = totalSuppliers ? (respondedSuppliers / totalSuppliers) * 100 : 0;
        
        // Add the participation rate to the response
        const enhancedResponse = {
            ...response,
            participationRate: parseFloat(participationRate.toFixed(2))
        };

        return reply.code(200).send({
            success: true,
            data: enhancedResponse
        });
    } catch (err) {
        console.error('Error in getting RFQ response by ID:', err);
        return reply.code(400).send({
            success: false,
            error: err.message || 'An error occurred while fetching the RFQ response'
        });
    }
};

module.exports = get_rfq_response_by_id;