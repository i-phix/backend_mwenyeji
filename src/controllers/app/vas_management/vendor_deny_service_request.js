const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const vendor_reject_service_request = async (request, reply) => {
    try {
        const { token, notes } = request.body;

        if (!token) {
            return reply.code(400).send({ success: false, message: 'Missing token' });
        }

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        const { r: requestId, f: facilityId } = decoded;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);

        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        serviceRequest.status = 'Pending';
        serviceRequest.notes = notes || null;
        serviceRequest.assigneeId = null;

        await serviceRequest.save();

        // Notify facility admin
        const facilityMessage = `Service request #${serviceRequest.requestNumber} has been denied by the vendor. Please login to reassign`;

        const facilityAdmin = await payservedb.User.findOne({
            'customerData.facilityId': facilityId,
            type: 'Company',
            role: 'admin'
        }).select('fullName email phoneNumber');

        if (facilityAdmin) {
            await sendSms(facilityId, facilityAdmin.phoneNumber, facilityMessage);
            await sendEmail(facilityId, facilityAdmin.email, 'Service Request', facilityMessage);
        }

        return reply.code(200).send({
            success: true,
            message: 'Service request rejected successfully',
            data: {
                requestId: serviceRequest._id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status,
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

module.exports = vendor_reject_service_request;