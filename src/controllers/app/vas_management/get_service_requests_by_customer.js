const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_customer_service_requests = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        const customer = await payservedb.Customer.findById(customerId);

        if (!customer) {
            return reply.code(404).send({
                success: false,
                message: 'Customer not found'
            });
        }

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        // Query service requests for this specific customer
        const requests = await ServiceRequest.find({
            facilityId,
            customerId: customerId
        })
            .sort({ createdAt: -1 }); // Most recent first

        // Manually populate unit and service data
        const populatedRequests = await Promise.all(requests.map(async (request) => {
            const requestObj = request.toObject();

            try {
                if (request.unitId) {
                    const unit = await Unit.findById(request.unitId).select('name unitNumber unitType floorUnitNo');
                    requestObj.unit = unit ? unit.toObject() : null;
                }
            } catch (unitError) {
                console.error('Error fetching unit:', unitError);
                requestObj.unit = null;
            }

            try {
                if (request.serviceId) {
                    const service = await ValueAddedService.findById(request.serviceId).select('serviceName description category');
                    requestObj.service = service ? service.toObject() : null;
                }
            } catch (serviceError) {
                console.error('Error fetching service:', serviceError);
                requestObj.service = null;
            }

            try {
                if (request.assigneeId) {
                    const vendor = await Vendor.findById(request.assigneeId)
                        .select('name contactDetails.name contactDetails.email contactDetails.phone');

                    requestObj.vendor = vendor ? vendor.toObject() : null;
                } else {
                    requestObj.vendor = null;
                }
            } catch (vendorError) {
                console.error('Error fetching vendor:', vendorError);
                requestObj.vendor = null;
            }

            // Add customer data
            requestObj.customer = {
                fullName: customer.fullName,
                email: customer.email,
                phoneNumber: customer.phoneNumber,
            };

            return requestObj;
        }));

        return reply.code(200).send({
            success: true,
            message: 'Customer service requests retrieved successfully',
            requests: populatedRequests,
            total: populatedRequests.length,
            customer: {
                fullName: customer.fullName,
                email: customer.email,
                phoneNumber: customer.phoneNumber
            }
        });

    } catch (err) {
        return reply.code(500).send({
            success: false,
            message: err.message
        });
    }
};

module.exports = get_customer_service_requests;