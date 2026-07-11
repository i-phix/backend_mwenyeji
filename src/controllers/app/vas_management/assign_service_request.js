const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');
const jwt = require('jsonwebtoken');

const assign_service_request = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            requestId,
            vendorId,
        } = request.body;

        if (!requestId || !vendorId) {
            return reply.code(400).send({
                success: false,
                message: 'Missing required fields: requestId and vendorId are required'
            });
        }

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);

        // Find the service request
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({
                success: false,
                message: 'Service request not found'
            });
        }

        if (serviceRequest.assigneeId) {
            return reply.code(400).send({
                success: false,
                message: 'This request is already assigned to a vendor. Please reassign if needed.'
            });
        }

        // Check if request is already assigned to a vendor
        if (serviceRequest.assignedVendor) {
            return reply.code(400).send({
                success: false,
                message: 'This request is already assigned to a vendor. Please reassign if needed.'
            });
        }

        // Get vendor
        const Vendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);
        const vendor = await Vendor.findById(vendorId);

        if (!vendor) {
            return reply.code(404).send({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Format vendor information with all available details from the response structure
        const vendorInfo = {
            _id: vendor._id,
            name: vendor.name,
            contactDetails: vendor.contactDetails || {
                name: vendor.contactPerson,
                phone: vendor.phone,
                email: vendor.email
            },
            address: vendor.address,
            notes: vendor.notes,
            offers: vendor.offers || [],
            status: vendor.status
        };

        // Update the request with vendor assignment
        serviceRequest.assigneeId = vendor._id;

        // Save the updated request
        await serviceRequest.save();

        // short keys: r = requestId, v = vendorId, f = facilityId
        const token = jwt.sign(
            {
                r: serviceRequest._id,
                v: vendor._id,
                f: facilityId,         // embed it in the token
            },
            process.env.VENDOR_TOKEN_SECRET,
            { expiresIn: '3d' }  
        );

        const vendorLink = `${process.env.appFrontEndUrl}/facility/value_added_services/approve?token=${token}`;

        // Send SMS and email notifications
        if (vendorInfo.contactDetails.phone && vendorInfo.contactDetails.email) {
            const message = `Hello ${vendor.name}, you have been assigned service request ${serviceRequest.requestNumber}. Review and respond here: ${vendorLink}`;
            await sendSms(facilityId, vendor.contactDetails.phone, message);
            await sendEmail(facilityId, vendor.contactDetails.email, 'Service Request Assignment', message);
        }


        // Return success response with vendor information
        return reply.code(200).send({
            success: true,
            message: `Service request successfully assigned to vendor: ${vendor.name}`,
            data: {
                request: {
                    _id: serviceRequest._id,
                    requestNumber: serviceRequest.requestNumber,
                    status: serviceRequest.status,
                    assignedAt: serviceRequest.assignedAt,
                    assignedBy: serviceRequest.assignedByName,
                    notes: serviceRequest.assignmentNotes
                },
                vendor: vendorInfo
            }
        });

    } catch (err) {
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = assign_service_request;