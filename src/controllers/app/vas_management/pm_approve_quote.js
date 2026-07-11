const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const pm_approve_service_request = async (request, reply) => {
    try {
        const { token } = request.body;

        if (!token) return reply.code(400).send({ success: false, message: 'Missing token' });

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        // ✅ Ensure this token is meant for PM, not vendor
        if (decoded.role !== 'pm') {
            return reply.code(403).send({ success: false, message: 'This link is not valid for PM approval' });
        }

        const { r: requestId, f: facilityId } = decoded;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) return reply.code(404).send({ success: false, message: 'Service request not found' });

        if (serviceRequest.status !== 'Awaiting PM') {
            return reply.code(400).send({
                success: false,
                message: `This request is in ${serviceRequest.status.toLowerCase()} status and cannot be actioned`
            });
        }

        // ✅ Move to resident-facing status
        serviceRequest.status = 'Awaiting';
        await serviceRequest.save();

        // ✅ Now notify the resident — same flow as before
        const customer = await payservedb.Customer
            .findById(serviceRequest.customerId)
            .select('phoneNumber email fullName');

        if (!customer) return reply.code(404).send({ success: false, message: 'Customer not found' });

        const residentToken = jwt_authentication.sign(
            { r: serviceRequest._id, f: facilityId },
            process.env.RESIDENT_TOKEN_SECRET,
            { expiresIn: '3d' }
        );

        const residentLink = `${process.env.residentFrontEndUrl}/resident/value_added_services/quote?token=${residentToken}`;
        const message = `Your service request #${serviceRequest.requestNumber} has been approved by management. Amount: KES ${Number(serviceRequest.quote).toLocaleString()}.${serviceRequest.notes ? ` Notes: ${serviceRequest.notes}.` : ''} Review and respond here: ${residentLink}`;

        await sendSms(facilityId, customer.phoneNumber, message);
        await sendEmail(facilityId, customer.email, 'Service Request Quote - Your Approval Needed', message);

        return reply.code(200).send({
            success: true,
            message: 'Quote approved by PM. Resident has been notified.',
            data: {
                requestId: serviceRequest._id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status,
            }
        });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
};

module.exports = pm_approve_service_request;