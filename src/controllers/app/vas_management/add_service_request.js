const path = require('path');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { getNextServiceRequestNumber } = require('../../../utils/serviceRequestNumber');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const create_service_request = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const {
            unitId,
            serviceId,
            requestType,
            description,
            preferredDate,
            preferredTime,
        } = request.body;

        // Look up the unit to get the customerId (tenantId/residentId)
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const unit = await Unit.findById(unitId);

        if (!unit) {
            return reply.code(404).send({
                success: false,
                message: 'Unit not found'
            });
        }

        // tenantId and residentId are the same — use whichever is populated
        const customerId = unit.tenantId || unit.residentId;

        if (!customerId) {
            return reply.code(400).send({
                success: false,
                message: 'No tenant or resident found for this unit'
            });
        }

        const requestNumber = await getNextServiceRequestNumber(facilityId, {
            prefix: 'SR',
            startFrom: 1000
        });

        const attachment = request.file
            ? `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.file.path)}`
            : null;

        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);

        const newServiceRequest = new ServiceRequest({
            facilityId,
            unitId,
            serviceId,
            customerId,
            requestType: requestType || 'RESIDENT',
            requestNumber: requestNumber,
            description,
            status: 'Pending',
            date: preferredDate || null,
            time: preferredTime || null,
            attachment: attachment || null,
        });

        const savedRequest = await newServiceRequest.save();

        // Notify facility admin
        const facilityMessage = `Service request #${savedRequest.requestNumber} has been created. Please login to view details.`;

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
            message: 'Service request created successfully',
            data: savedRequest
        });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
};

module.exports = create_service_request;