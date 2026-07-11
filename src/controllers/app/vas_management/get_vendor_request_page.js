const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_vendor_request_page = async (request, reply) => {
    try {
        const { token } = request.query;
        if (!token) {
            return reply.code(400).send({ success: false, message: 'Missing token' });
        }

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        const { r, v, f } = decoded;

        const requestId = r;
        const vendorId = v;
        const facilityId = f;

        console.log("DEcoded", decoded);

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        const serviceRequest = await ServiceRequest.findById(requestId).lean();

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        const vendor = await Vendor.findById(vendorId).lean();

        if (!vendor) {
            return reply.code(404).send({ success: false, message: 'Vendor not found' });
        }

        // Customer lives in global DB — same as get_service_requests
        let customerInfo = null;
        if (serviceRequest.customerId) {
            const customer = await payservedb.Customer.findById(serviceRequest.customerId)
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

        // Service info — lives in facility DB
        let serviceInfo = null;
        if (serviceRequest.serviceId) {
            const service = await ValueAddedService.findById(serviceRequest.serviceId)
                .select('serviceName')
                .lean();
            if (service) {
                serviceInfo = { serviceName: service.serviceName };
            }
        }

        // Unit info — lives in facility DB
        let unitInfo = null;
        if (serviceRequest.unitId) {
            const unit = await Unit.findById(serviceRequest.unitId)
                .select('name')
                .lean();
            if (unit) {
                unitInfo = { name: unit.name };
            }
        }

        return reply.code(200).send({
            success: true,
            serviceRequest: {
                ...serviceRequest,
                customer: customerInfo,
                service: serviceInfo,
                unit: unitInfo,
            },
            vendor: {
                _id: vendor._id,
                name: vendor.name,
                contactDetails: vendor.contactDetails
            },
            token

        });

    } catch (err) {
        return reply.code(500).send({ success: false, message: 'Server error', error: err.message });
    }
};

module.exports = get_vendor_request_page;