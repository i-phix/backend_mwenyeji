const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const pm_deny_service_request = async (request, reply) => {
    try {
        const { token, reason } = request.body;

        if (!token) return reply.code(400).send({ success: false, message: 'Missing token' });

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        if (decoded.role !== 'pm') {
            return reply.code(403).send({ success: false, message: 'This link is not valid for PM actions' });
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

        serviceRequest.status = 'Pending'; // ✅ Reset back so vendor can be reassigned/re-quoted
        serviceRequest.pmDenialReason = reason || null;
        await serviceRequest.save();

        // Contact the vendor
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);
        const vendor = await Vendor.findById(serviceRequest.assigneeId);

        if (vendor?.contactDetails?.phone && vendor?.contactDetails?.email) {
            const vendorMessage = `Hello ${vendor.name}, the Property Admin has rejected your quote for service request #${serviceRequest.requestNumber}. Reason: ${reason}`;
            await sendSms(facilityId, vendor.contactDetails.phone, vendorMessage);
            await sendEmail(facilityId, vendor.contactDetails.email, 'Quote Denied', vendorMessage);
        }

        return reply.code(200).send({
            success: true,
            message: 'Quote denied by PM. Request reset to Pending.',
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

module.exports = pm_deny_service_request;