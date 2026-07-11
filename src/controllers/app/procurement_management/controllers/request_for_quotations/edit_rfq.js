const payservedb = require('payservedb');

const edit_rfq = async (request, reply) => {
    try {
        const { facilityId, rfqId } = request.params;
        const {
            name,
            rfqNumber,
            startDate,
            closingDate,
            currency,
            rfqType,
            rfqFee,
            rfqEvaluationType,
            notes,
            status,
            categories,
            suppliers,
            awardDetails
        } = request.body;

        // Basic validation
        if (!rfqId) {
            return reply.code(400).send({
                success: false,
                error: 'RFQ ID is required'
            });
        }

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Check if RFQ exists
        const existingRfq = await payservedb.RFQDetails.findById(rfqId);
        if (!existingRfq) {
            return reply.code(404).send({
                success: false,
                error: 'RFQ not found'
            });
        }

        // Verify RFQ belongs to the specified facility
        if (existingRfq.facilityId.toString() !== facilityId) {
            return reply.code(403).send({
                success: false,
                error: 'RFQ does not belong to the specified facility'
            });
        }

        // Validate date range if both dates are provided
        if (startDate && closingDate) {
            const startDateObj = new Date(startDate);
            const closingDateObj = new Date(closingDate);
            
            if (startDateObj >= closingDateObj) {
                return reply.code(400).send({
                    success: false,
                    error: 'Closing date must be after start date'
                });
            }
        }
        
        const updateData = {};
        
        // Update only the fields that were provided
        if (name) updateData.name = name;
        if (rfqNumber) updateData.rfqNumber = rfqNumber;
        if (startDate) updateData.startDate = new Date(startDate);
        if (closingDate) updateData.closingDate = new Date(closingDate);
        if (currency) updateData.currency = currency;
        if (rfqType) updateData.rfqType = rfqType;
        if (rfqFee !== undefined) updateData.rfqFee = rfqFee;
        if (rfqEvaluationType) updateData.rfqEvaluationType = rfqEvaluationType;
        if (notes !== undefined) updateData.notes = notes;
        if (status) updateData.status = status;
        
        // Handle categories update
        if (categories) {
            // Validate categories
            for (const category of categories) {
                if (!category.name) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Each category must have a name'
                    });
                }

                // Validate products if provided
                if (category.products && category.products.length > 0) {
                    for (const product of category.products) {
                        if (!product.productName || !product.quantity) {
                            return reply.code(400).send({
                                success: false,
                                error: 'Each product must have a name and quantity'
                            });
                        }
                    }
                }

                // Validate services if provided
                if (category.services && category.services.length > 0) {
                    for (const service of category.services) {
                        if (!service.serviceDescription || !service.quantity) {
                            return reply.code(400).send({
                                success: false,
                                error: 'Each service must have a description and quantity'
                            });
                        }
                    }
                }
            }
            
            updateData.categories = categories;
        }
        
        // Handle suppliers update
        if (suppliers) updateData.suppliers = suppliers;
        
        // Handle award details update
        if (awardDetails) {
            // Update award details if RFQ status allows it
            if (existingRfq.status === 'awarded' || status === 'awarded') {
                updateData.awardDetails = {
                    ...existingRfq.awardDetails,
                    ...awardDetails
                };
                
                // If supplier was awarded, update the status accordingly
                if (awardDetails.awarded && !existingRfq.awardDetails.awarded) {
                    updateData.status = 'awarded';
                }
            } else {
                return reply.code(400).send({
                    success: false,
                    error: 'RFQ must be in "closed" status before it can be awarded'
                });
            }
        }

        const savedRfq = await payservedb.RFQDetails.findByIdAndUpdate(
            rfqId,
            updateData,
            { new: true }
        );

        return reply.code(200).send({
            success: true,
            message: 'RFQ updated successfully',
            data: savedRfq
        });
    } catch (err) {
        console.error('Error in updating RFQ:', err);
        return reply.code(400).send({ 
            success: false, 
            error: err.message || 'An error occurred while updating the RFQ'
        });
    }
};

module.exports = edit_rfq;