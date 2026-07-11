const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');
const { createVasInvoice } = require('./add_service_invoice');

const resident_accept_request_authenticated = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { requestId } = request.body;

        if (!requestId) {
            return reply.code(400).send({ success: false, message: 'Missing requestId' });
        }

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({ success: false, message: 'Service request not found' });
        }

        if (serviceRequest.status !== 'Awaiting') {
            return reply.code(400).send({ success: false, message: 'Request is not awaiting quote approval' });
        }

        serviceRequest.status = 'In Progress';
        serviceRequest.residentAcceptedAt = new Date();
        await serviceRequest.save();

        // Generate invoice
        try {
            await createVasInvoice({
                facilityId,
                serviceId: serviceRequest._id,
                customerId: serviceRequest.customerId,
                amount: serviceRequest.quote,
                status: 'Pending',
            });
        } catch (invoiceErr) {
            console.error('Invoice creation failed:', invoiceErr.message);
        }

        // Notify vendor
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);
        const vendor = await Vendor.findById(serviceRequest.assigneeId);

        if (vendor?.contactDetails?.phone && vendor?.contactDetails?.email) {
            const msg = `Hello ${vendor.name}, the resident has accepted your quote for service request #${serviceRequest.requestNumber}. Please proceed.`;
            await sendSms(facilityId, vendor.contactDetails.phone, msg);
            await sendEmail(facilityId, vendor.contactDetails.email, 'Quote Accepted', msg);
        }

        return reply.code(200).send({
            success: true,
            message: 'Quote accepted. Service request is now in progress.',
        });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
};

module.exports = resident_accept_request_authenticated;