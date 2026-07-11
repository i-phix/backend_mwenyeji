const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const vendor_approve_service_request = async (request, reply) => {
    try {
        const { token, quote, notes } = request.body;

        if (!token) {
            return reply.code(400).send({ success: false, message: 'Missing token' });
        }

        if (!quote || Number(quote) <= 0) {
            return reply.code(400).send({ success: false, message: 'A valid quote amount is required' });
        }

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        const { r: requestId, f: facilityId } = decoded;

        // const { r, requestId: legacyRequestId, f, facilityId: legacyFacilityId } = decoded;
        // const requestId = r || legacyRequestId;
        // const facilityId = f || legacyFacilityId;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);

        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        if (serviceRequest.status !== 'Pending') {
            return reply.code(400).send({
                success: false,
                message: `This request is in ${serviceRequest.status.toLowerCase()} status and cannot be approved`
            });
        }

        serviceRequest.status = 'Awaiting';
        serviceRequest.quote = Number(quote);
        serviceRequest.notes = notes || null;

        await serviceRequest.save();

        const customerId = serviceRequest.customerId;

        const Customer = payservedb.Customer;

        const customer = await Customer
            .findById(customerId)
            .select('phoneNumber email fullName');

        if (!customer) {
            return reply.code(404).send({
                success: false,
                message: 'Customer not found'
            });
        }

        const residentToken = jwt_authentication.sign(
            {
                r: serviceRequest._id,
                f: facilityId,
            },
            process.env.RESIDENT_TOKEN_SECRET,
            { expiresIn: '3d' }
        );

        const customerInfo = {
            phoneNumber: customer.phoneNumber,
            email: customer.email,
            fullName: customer.fullName
        };

        const residentLink = `${process.env.residentFrontEndUrl}/resident/value_added_services/quote?token=${residentToken}`;

        const message = `You have received a quote for service request #${serviceRequest.requestNumber}. Amount: KES ${Number(quote).toLocaleString()}.${notes ? ` Notes: ${notes}.` : ''} Review and respond here: ${residentLink}`;

        await sendSms(facilityId, customerInfo.phoneNumber, message);
        await sendEmail(facilityId, customerInfo.email, 'Service request quote', message);

        return reply.code(200).send({
            success: true,
            message: 'Service request accepted and quote submitted successfully',
            data: {
                requestId: serviceRequest._id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status,
                vendorQuote: serviceRequest.quote,
                vendorNotes: serviceRequest.notes,
            }
        });

    } catch (err) {
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = vendor_approve_service_request;