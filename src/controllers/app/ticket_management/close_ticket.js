// const payservedb = require('payservedb');
// const { getModel } = require('../../../utils/getModel');

// const CloseTicket = async (request, reply) => {
//     try {
//         const { ticketId } = request.params;
//         const { status, reason } = request.body;

//         // Get the ticket model using the facilityId from request params
//         const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, request.params.facilityId);

//         // Update the ticket in the database
//         const updatedTicket = await ticketModel.findByIdAndUpdate(
//             ticketId,
//             { 
//                 status, 
//                 closingReason: reason,
//                 reviewed: true // Set the reviewed field to true
//             },
//             { new: true } // Return the updated document
//         );

//         if (!updatedTicket) {
//             return reply.status(404).json({ success: false, message: 'Ticket not found' });
//         }

//         return reply.status(200).send({ message: 'Ticket closed successfully', data: updatedTicket });
//     } catch (err) {
//         console.error('Error in closing ticket:', err);
//         return reply.code(400).send({ error: err.message });
//     }
// }

// module.exports = CloseTicket;



const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const CloseTicket = async (request, reply) => {
    try {
        const { ticketId, facilityId } = request.params;
        const { status, reason } = request.body;

        // Get the ticket model using the facilityId from request params
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find the ticket first to get customer information
        const ticket = await ticketModel.findById(ticketId);

        if (!ticket) {
            return reply.status(404).json({ success: false, message: 'Ticket not found' });
        }

        // Update the ticket in the database
        const updatedTicket = await ticketModel.findByIdAndUpdate(
            ticketId,
            {
                status,
                closingReason: reason,
                reviewed: true // Set the reviewed field to true
            },
            { new: true } // Return the updated document
        );

        // Notify the customer if the ticket has a customerId
        if (ticket.customerId) {
            try {
                const customer = await payservedb.Customer.findById(ticket.customerId);

                if (customer) {
                    const customerName = `${customer.firstName} ${customer.lastName}`;
                    const ticketSubject = ticket.subject || 'Maintenance Ticket';

                    // SMS Message
                    const smsMessage = `Dear ${customerName}, your maintenance ticket "${ticketSubject}" (Ticket #${ticket.ticketNumber}) has been closed. ${reason ? `Reason: ${reason}` : 'Thank you for using our service.'}`;

                    // Email Message (more detailed)
                    const emailSubject = `Ticket Closed: ${ticketSubject} (#${ticket.ticketNumber})`;
                    const emailMessage = `
                    Dear ${customerName},

                    Your maintenance ticket has been closed.

                    Ticket Details:
                    - Ticket Number: ${ticket.ticketNumber}
                    - Subject: ${ticketSubject}
                    - Description: ${ticket.description}
                    - Priority: ${ticket.priority}
                    - Status: Closed
                    ${reason ? `- Closing Reason: ${reason}\n` : ''}

                    Date Closed: ${new Date().toLocaleDateString()}

                    Thank you for using our maintenance service. If you have any questions or need to reopen this ticket, please contact our support team.

                    Best regards,
                    Maintenance Team
                    `;

                    // Send SMS if phone number exists
                    if (customer.phoneNumber) {
                        await sendSms(facilityId, customer.phoneNumber, smsMessage);
                        console.log(`SMS notification sent to ${customer.phoneNumber} for ticket #${ticket.ticketNumber}`);
                    }

                    // Send Email if email exists
                    if (customer.email) {
                        await sendEmail(facilityId, customer.email, emailSubject, emailMessage.trim());
                        console.log(`Email notification sent to ${customer.email} for ticket #${ticket.ticketNumber}`);
                    }

                    // Log if no contact methods available
                    if (!customer.phoneNumber && !customer.email) {
                        console.log(`Ticket #${ticket.ticketNumber} closed but no contact methods available for customer ${customerName}`);
                    }
                } else {
                    console.log(`Customer not found for ID: ${ticket.customerId} when closing ticket #${ticket.ticketNumber}`);
                }
            } catch (notificationError) {
                // Log notification errors but don't fail the ticket closing
                console.error('Error sending notification:', notificationError);
            }
        } else {
            console.log(`Ticket #${ticket.ticketNumber} closed but no customerId associated`);
        }

        return reply.status(200).send({
            success: true,
            message: 'Ticket closed successfully',
            data: updatedTicket
        });
    } catch (err) {
        console.error('Error in closing ticket:', err);
        return reply.code(400).send({
            success: false,
            error: err.message
        });
    }
}

module.exports = CloseTicket;