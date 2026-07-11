const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
// const pdfkit = require('pdfkit'); // For PDF export
// const ExcelJS = require('exceljs'); // For Excel export

const GetTickets = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { export: exportType } = request.query;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
        const tickets = await ticketModel.find({});

        const ticketsWithCustomerInfo = await Promise.all(tickets.map(async (ticket) => {
            const customer = await payservedb.Customer.findById(ticket.customerId);
            return {
                ...ticket.toObject(),
                CustomerInfo: {
                    fullName: `${customer.firstName} ${customer.lastName}`,
                    phoneNumber: customer.phoneNumber,
                    email: customer.email
                }
            };
        }));

        if (!ticketsWithCustomerInfo || ticketsWithCustomerInfo.length === 0) {
            return reply.code(404).send({ message: 'No tickets found for this facility.' });
        }

        // Check if export is requested
        if (exportType === 'pdf') {
            const doc = new pdfkit();
            doc.text('Ticket Report', { align: 'center' });
            ticketsWithCustomerInfo.forEach((ticket) => {
                doc.text(`Ticket Number: ${ticket.ticketNumber}`);
                doc.text(`Subject: ${ticket.subject}`);
                doc.text(`Type: ${ticket.ticketType}`);
                doc.text(`Priority: ${ticket.priority}`);
                doc.text(`Status: ${ticket.status}`);
                doc.text(`Customer: ${ticket.CustomerInfo.fullName}`);
                doc.text(`Phone: ${ticket.CustomerInfo.phoneNumber}`);
                doc.text(`Email: ${ticket.CustomerInfo.email}`);
                doc.moveDown();
            });

            reply.type('application/pdf');
            return reply.send(doc);
        }

        if (exportType === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Tickets Report');

            // Define columns
            worksheet.columns = [
                { header: 'Ticket Number', key: 'ticketNumber', width: 15 },
                { header: 'Subject', key: 'subject', width: 20 },
                { header: 'Type', key: 'ticketType', width: 15 },
                { header: 'Priority', key: 'priority', width: 10 },
                { header: 'Status', key: 'status', width: 10 },
                { header: 'Customer Name', key: 'fullName', width: 20 },
                { header: 'Phone', key: 'phoneNumber', width: 15 },
                { header: 'Email', key: 'email', width: 25 },
            ];

            // Add rows
            ticketsWithCustomerInfo.forEach((ticket) => {
                worksheet.addRow({
                    ticketNumber: ticket.ticketNumber,
                    subject: ticket.subject,
                    ticketType: ticket.ticketType,
                    priority: ticket.priority,
                    status: ticket.status,
                    fullName: ticket.CustomerInfo.fullName,
                    phoneNumber: ticket.CustomerInfo.phoneNumber,
                    email: ticket.CustomerInfo.email,
                });
            });

            // Prepare response
            const buffer = await workbook.xlsx.writeBuffer();
            reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            reply.header('Content-Disposition', 'attachment; filename="Tickets_Report.xlsx"');
            return reply.send(Buffer.from(buffer));
        }

        // Default: Return tickets as JSON
        return reply.code(200).send({ message: 'Tickets retrieved successfully', tickets: ticketsWithCustomerInfo });
    } catch (err) {
        console.error('Error in retrieving tickets:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetTickets;

