const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const AssignTicket = async (request, reply) => {
    try {
        const { ticketId, facilityId } = request.params;
        const { byWho, selectedEmployee, selectedVendor, status } = request.body;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        const updateData = {
            status: status,
            isAssigned: true
        };

        let phoneNumber = null;
        let assignedName = null;
        let isStaff = false;

        if (byWho) {
            updateData.byWho = byWho;

            if (byWho === 'propertyManager' && selectedEmployee) {
                updateData.selectedEmployee = selectedEmployee.id;
                updateData.selectedVendor = null;

                // Use details from frontend
                phoneNumber = selectedEmployee.phoneNumber;
                email = selectedEmployee.email;
                assignedName = selectedEmployee.fullName;
                isStaff = true;
            } else if (byWho === 'vendor' && selectedVendor) {
                updateData.selectedVendor = selectedVendor.id;
                updateData.selectedEmployee = null;

                // Use details from frontend
                phoneNumber = selectedVendor.phoneNumber;
                email = selectedVendor.email;
                assignedName = selectedVendor.name;
                isStaff = false;
            }
        }

        const updatedTicket = await ticketModel.findByIdAndUpdate(
            ticketId,
            updateData,
            { new: true }
        );

        if (!updatedTicket) {
            return reply.status(404).json({ success: false, message: 'Ticket not found' });
        }

        // Send SMS using your existing structure
        if (phoneNumber && email && assignedName) {
            try {
                const baseUrl = "https://app.payserve.co.ke/facility/ticket_management/staff_notification";
                const actionLink = `${baseUrl}/${ticketId}`;

                let message = "";
                if (isStaff) {
                    message = `You have been assigned to a ticket Review Process. Click on the link to check your assignments: ${actionLink}`;
                } else {
                    message = `You have been assigned to a task from the ticket review process. Please check your assignments: ${actionLink}`;
                }

                sendSms(facilityId, phoneNumber, message);
                sendEmail(facilityId, email, 'Ticket Review', message);

                console.log(`SMS sent to ${assignedName} at ${phoneNumber}`);
            } catch (smsError) {
                console.error('Failed to send SMS:', smsError);
            }
        }

        return reply.status(200).send({
            success: true,
            message: 'Ticket Assigned successfully',
            data: updatedTicket
        });
    } catch (err) {
        console.error('Error in assigning ticket:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

module.exports = AssignTicket;