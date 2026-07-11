const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const resident_deny_service_request = async (request, reply) => {
    try {
        const { token, reason } = request.body;

        if (!token) {
            return reply.code(400).send({ success: false, message: 'Missing token' });
        }

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.RESIDENT_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        // const { requestId, facilityId } = decoded;
        const { r, f } = decoded;

        const requestId = r;
        const facilityId = f;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        const previousVendorId = serviceRequest.assigneeId;

        // Reset back to Pending and clear vendor assignment + quote
        serviceRequest.status = 'Pending';
        serviceRequest.assigneeId = null;
        serviceRequest.quote = null;
        serviceRequest.notes = null;
        serviceRequest.denyReason = reason;
        serviceRequest.residentDeniedAt = new Date();
        await serviceRequest.save();

        // Notify facility admin
        const facilityMessage = `Service request #${serviceRequest.requestNumber} quote was denied by the resident.${reason ? ` Reason: ${reason}.` : ''} Please reassign to another vendor.`;

        const facilityAdmin = await payservedb.User.findOne({
            'customerData.facilityId': facilityId,
            type: 'Company',
            role: 'admin'
        }).select('fullName email phoneNumber');

        if (facilityAdmin) {
            await sendSms(facilityId, facilityAdmin.phoneNumber, facilityMessage);
            await sendEmail(facilityId, facilityAdmin.email, 'Service Request Quote Denied', facilityMessage);
        }

        return reply.code(200).send({
            success: true,
            message: 'Quote denied. Request has been reset and facility has been notified.',
            data: {
                requestId: serviceRequest._id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status,
                previousVendorId,
            }
        });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
};

module.exports = resident_deny_service_request;