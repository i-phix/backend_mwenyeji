const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_pm_request_page = async (request, reply) => {
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

        const { r, f, role } = decoded;

        if (role !== 'pm') {
            return reply.code(403).send({ success: false, message: 'This link is not valid for PM access' });
        }

        const requestId = r;
        const facilityId = f;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        const serviceRequest = await ServiceRequest.findById(requestId).lean();

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        if (serviceRequest.status !== 'Awaiting PM') {
            return reply.code(400).send({
                success: false,
                message: `This request is in ${serviceRequest.status.toLowerCase()} status and cannot be reviewed`
            });
        }

        // Customer — global DB
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

        // Service info — facility DB
        let serviceInfo = null;
        if (serviceRequest.serviceId) {
            const service = await ValueAddedService.findById(serviceRequest.serviceId)
                .select('serviceName')
                .lean();
            if (service) {
                serviceInfo = { serviceName: service.serviceName };
            }
        }

        // Unit info — facility DB
        let unitInfo = null;
        if (serviceRequest.unitId) {
            const unit = await Unit.findById(serviceRequest.unitId)
                .select('name')
                .lean();
            if (unit) {
                unitInfo = { name: unit.name };
            }
        }

        // Vendor info — facility DB (vendor was already assigned when the request was sent out)
        let vendorInfo = null;
        if (serviceRequest.assigneeId) {
            const vendor = await Vendor.findById(serviceRequest.assigneeId).lean();
            if (vendor) {
                vendorInfo = {
                    _id: vendor._id,
                    name: vendor.name,
                    contactDetails: vendor.contactDetails
                };
            }
        }

        return reply.code(200).send({
            success: true,
            data: {
                serviceRequest: {
                    ...serviceRequest,
                    customer: customerInfo,
                    service: serviceInfo,
                    unit: unitInfo,
                },
                vendor: vendorInfo,
            },
            token
        });

    } catch (err) {
        return reply.code(500).send({ success: false, message: 'Server error', error: err.message });
    }
};

module.exports = get_pm_request_page;