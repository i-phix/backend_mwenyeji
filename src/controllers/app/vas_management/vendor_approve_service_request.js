// const jwt_authentication = require('jsonwebtoken');
// const payservedb = require('payservedb');
// const { getModel } = require('../../../utils/getModel');
// const { sendSms } = require('../../../utils/send_new_sms');
// const { sendEmail } = require('../../../utils/send_new_email');

// const vendor_approve_service_request = async (request, reply) => {
//     try {
//         const { token, quote, notes } = request.body;

//         if (!token) {
//             return reply.code(400).send({ success: false, message: 'Missing token' });
//         }

//         if (!quote || Number(quote) <= 0) {
//             return reply.code(400).send({ success: false, message: 'A valid quote amount is required' });
//         }

//         let decoded;
//         try {
//             decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
//         } catch (e) {
//             return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
//         }

//         const { r: requestId, f: facilityId } = decoded;

//         // const { r, requestId: legacyRequestId, f, facilityId: legacyFacilityId } = decoded;
//         // const requestId = r || legacyRequestId;
//         // const facilityId = f || legacyFacilityId;

//         const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);

//         const serviceRequest = await ServiceRequest.findById(requestId);

//         if (!serviceRequest) {
//             return reply.code(404).send({ success: false, message: 'Service request not found' });
//         }

//         if (serviceRequest.status !== 'Pending') {
//             return reply.code(400).send({
//                 success: false,
//                 message: `This request is in ${serviceRequest.status.toLowerCase()} status and cannot be approved`
//             });
//         }

//         serviceRequest.status = 'Awaiting';
//         serviceRequest.quote = Number(quote);
//         serviceRequest.notes = notes || null;

//         await serviceRequest.save();

//         const customerId = serviceRequest.customerId;

//         const Customer = payservedb.Customer;

//         const customer = await Customer
//             .findById(customerId)
//             .select('phoneNumber email fullName');

//         if (!customer) {
//             return reply.code(404).send({
//                 success: false,
//                 message: 'Customer not found'
//             });
//         }

//         const residentToken = jwt_authentication.sign(
//             {
//                 r: serviceRequest._id,
//                 f: facilityId,
//             },
//             process.env.RESIDENT_TOKEN_SECRET,
//             { expiresIn: '3d' }
//         );

//         const customerInfo = {
//             phoneNumber: customer.phoneNumber,
//             email: customer.email,
//             fullName: customer.fullName
//         };

//         const residentLink = `${process.env.residentFrontEndUrl}/resident/value_added_services/quote?token=${residentToken}`;

//         // const message = `You have received a quote for service request #${serviceRequest.requestNumber}. Amount: KES ${Number(quote).toLocaleString()}.${notes ? ` Notes: ${notes}.` : ''} Review and respond here: ${residentLink}`;

//         // await sendSms(facilityId, customerInfo.phoneNumber, message);
//         // await sendEmail(facilityId, customerInfo.email, 'Service request quote', message);

//         // Notify facility admin
//         const message = `Quote for service request #${serviceRequest.requestNumber}. Amount: KES ${Number(quote).toLocaleString()}.${notes ? ` Notes: ${notes}.` : ''} Review and respond here: ${residentLink}`;

//         const facilityAdmin = await payservedb.User.findOne({
//             'customerData.facilityId': facilityId,
//             type: 'Company',
//             role: 'admin'
//         }).select('fullName email phoneNumber');

//         console.log("facilityyyyyyyyyyyyyyyyyy adminnnnnnnnnnnnnnnnnnn", facilityAdmin);

//         if (facilityAdmin) {
//             await sendSms(facilityId, facilityAdmin.phoneNumber, message);
//             await sendEmail(facilityId, facilityAdmin.email, 'Service Request', message);
//         }


//         return reply.code(200).send({
//             success: true,
//             message: 'Service request accepted and quote submitted successfully',
//             data: {
//                 requestId: serviceRequest._id,
//                 requestNumber: serviceRequest.requestNumber,
//                 status: serviceRequest.status,
//                 vendorQuote: serviceRequest.quote,
//                 vendorNotes: serviceRequest.notes,
//             }
//         });

//     } catch (err) {
//         return reply.code(500).send({
//             success: false,
//             error: err.message
//         });
//     }
// };

// module.exports = vendor_approve_service_request;







const jwt_authentication = require('jsonwebtoken');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const vendor_approve_service_request = async (request, reply) => {
    try {
        const { token, quote, notes } = request.body;

        if (!token) return reply.code(400).send({ success: false, message: 'Missing token' });
        if (!quote || Number(quote) <= 0) return reply.code(400).send({ success: false, message: 'A valid quote amount is required' });

        let decoded;
        try {
            decoded = jwt_authentication.verify(token, process.env.VENDOR_TOKEN_SECRET);
        } catch (e) {
            return reply.code(401).send({ success: false, message: 'Invalid or expired link' });
        }

        const { r: requestId, f: facilityId } = decoded;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) return reply.code(404).send({ success: false, message: 'Service request not found' });

        if (serviceRequest.status !== 'Pending') {
            return reply.code(400).send({
                success: false,
                message: `This request is in ${serviceRequest.status.toLowerCase()} status and cannot be approved`
            });
        }

        // ✅ New intermediate status — waiting for PM
        serviceRequest.status = 'Awaiting PM';
        serviceRequest.quote = Number(quote);
        serviceRequest.notes = notes || null;
        await serviceRequest.save();

        // ✅ Generate PM token — reuse VENDOR_TOKEN_SECRET but tag role as 'pm'
        const pmToken = jwt_authentication.sign(
            { r: serviceRequest._id, f: facilityId, role: 'pm' },
            process.env.VENDOR_TOKEN_SECRET,
            { expiresIn: '3d' }
        );

        const pmLink = `${process.env.appFrontEndUrl}/facility/value_added_services/pm_approve?token=${pmToken}`;
        const message = `A vendor has submitted a quote for service request #${serviceRequest.requestNumber}. Amount: KES ${Number(quote).toLocaleString()}.${notes ? ` Notes: ${notes}.` : ''} Review and respond here: ${pmLink}`;

        const facilityAdmin = await payservedb.User.findOne({
            'customerData.facilityId': facilityId,
            type: 'Company',
            role: 'admin'
        }).select('fullName email phoneNumber');

        console.log('[vendor_approve] facilityId:', facilityId);
        console.log('[vendor_approve] facilityAdmin:', facilityAdmin);

        if (facilityAdmin) {
            await sendSms(facilityId, facilityAdmin.phoneNumber, message);
            await sendEmail(facilityId, facilityAdmin.email, 'Service Request Quote - Action Required', message);
        } else {
            console.warn('[vendor_approve] No admin found — SMS/email skipped');
        }

        return reply.code(200).send({
            success: true,
            message: 'Quote submitted. Property manager has been notified for approval.',
            data: {
                requestId: serviceRequest._id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status,
                vendorQuote: serviceRequest.quote,
                vendorNotes: serviceRequest.notes,
            }
        });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
};

module.exports = vendor_approve_service_request;