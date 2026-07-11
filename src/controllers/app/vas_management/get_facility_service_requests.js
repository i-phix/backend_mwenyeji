const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_service_requests = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        const VasVendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        const requests = await ServiceRequest.find({ facilityId })
            .sort({ createdAt: -1 })
            .lean();

        const populatedRequests = await Promise.all(
            requests.map(async (req) => {

                let customerInfo = null;
                if (req.customerId) {
                    const customer = await payservedb.Customer.findById(req.customerId)
                        .select('firstName lastName phoneNumber email')
                        .lean();
                    if (customer) {
                        customerInfo = {
                            fullName: `${customer.firstName} ${customer.lastName}`,
                            phoneNumber: customer.phoneNumber,
                            email: customer.email
                        };
                    }
                }

                let serviceInfo = null;
                if (req.serviceId) {
                    const service = await ValueAddedService.findById(req.serviceId)
                        .select('serviceName')
                        .lean();
                    if (service) {
                        serviceInfo = {
                            serviceName: service.serviceName
                        };
                    }
                }

                let unitInfo = null;
                if (req.unitId) {
                    const unit = await Unit.findById(req.unitId)
                        .select('name')
                        .lean();
                    if (unit) {
                        unitInfo = {
                            name: unit.name,
                        };
                    }
                }

                // Assignee/VasVendor (lives in facility DB)
                let assigneeInfo = null;
                if (req.assigneeId) {
                    const vendor = await VasVendor.findById(req.assigneeId)
                        .select('name contactDetails')
                        .lean();
                    if (vendor) {
                        assigneeInfo = {
                            name: vendor.name,
                            contactName: vendor.contactDetails?.name || null,
                            email: vendor.contactDetails?.email || null,
                            phone: vendor.contactDetails?.phone || null,
                        };
                    }
                }

        

                return {
                    ...req,
                    customer: customerInfo,
                    serviceId: serviceInfo,
                    unitId: unitInfo,
                    assignee: assigneeInfo,
                };
            })
        );

        return reply.code(200).send({
            success: true,
            message: 'Service requests retrieved successfully',
            requests: populatedRequests,
            total: populatedRequests.length,
        });

    } catch (err) {
        console.error('Error fetching service requests:', err);

        if (err.name === 'CastError' && err.kind === 'ObjectId') {
            return reply.code(400).send({ success: false, message: `Invalid ${err.path} format` });
        }

        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message,
        });
    }
};

module.exports = get_service_requests;