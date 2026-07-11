const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');
const { createVasInvoice } = require('./add_service_invoice');

const resident_accept_service_request = async (request, reply) => {
    try {
        const { token } = request.body;
        if (!token) {
            return reply.code(400).send({ success: false, message: 'Missing token' });
        }

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.RESIDENT_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        const { r, f } = decoded;
        const requestId = r;
        const facilityId = f;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        serviceRequest.status = 'In Progress';
        serviceRequest.residentAcceptedAt = new Date();
        await serviceRequest.save();

        // ── Generate Invoice ──────────────────────────────────────────────────
        let invoiceResult = null;
        try {
            invoiceResult = await createVasInvoice({
                facilityId,
                serviceId: serviceRequest._id,
                customerId: serviceRequest.customerId,
                amount: serviceRequest.quote,
                status: 'Pending',
            });
        } catch (invoiceErr) {
            // Don't fail the whole accept if invoice creation fails — log and continue
            console.error('Invoice creation failed after resident accept:', invoiceErr.message);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Notify the assigned vendor
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);
        const vendor = await Vendor.findById(serviceRequest.assigneeId);

        if (vendor?.contactDetails?.phone && vendor?.contactDetails?.email) {
            const vendorMessage = `Hello ${vendor.name}, the resident has accepted your quote for service request #${serviceRequest.requestNumber}. Please proceed with the service.`;
            await sendSms(facilityId, vendor.contactDetails.phone, vendorMessage);
            await sendEmail(facilityId, vendor.contactDetails.email, 'Quote Accepted', vendorMessage);
        }

        return reply.code(200).send({
            success: true,
            message: 'Quote accepted. Service request is now in progress.',
            data: {
                requestId: serviceRequest._id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status,
                invoiceNumber: invoiceResult?.invoiceNumber ?? null,
            }
        });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
};

module.exports = resident_accept_service_request;