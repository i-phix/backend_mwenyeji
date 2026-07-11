const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetTicket = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
        const ticket = await ticketModel.findOne({ _id: ticketId, facilityId });

        if (!ticket) {
            return reply.code(404).send({ message: 'Ticket not found.' });
        }

        // Fetch user or customer info based on who raised the ticket
        let requesterInfo = null;
        let isStaff = false;

        if (ticket.customerId) {
            const customer = await payservedb.Customer.findById(ticket.customerId);
            if (customer) {
                requesterInfo = {
                    fullName: `${customer.firstName} ${customer.lastName}`,
                    phoneNumber: customer.phoneNumber,
                    email: customer.email,
                    requester: customer._id,
                };
            }
        } else if (ticket.userId) {
            const user = await payservedb.User.findById(ticket.userId);
            if (user) {
                requesterInfo = {
                    fullName: `${user.fullName}`,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                    requester: user._id,
                };
                isStaff = true;
            }
        }

        // Fetch assigned employee details if exists
        let assignedEmployeeInfo = null;
        if (ticket.selectedEmployee) {
            const employee = await payservedb.User.findById(ticket.selectedEmployee);
            if (employee) {
                assignedEmployeeInfo = {
                    fullName: employee.fullName,
                    phoneNumber: employee.phoneNumber,
                    email: employee.email,
                    _id: employee._id,
                };
            }
        }

        // Fetch assigned vendor details if exists
        let assignedVendorInfo = null;
        if (ticket.selectedVendor) {
            const vendor = await payservedb.User.findById(ticket.selectedVendor);
            if (vendor) {
                assignedVendorInfo = {
                    name: vendor.fullName,
                    contactInfo: vendor.phoneNumber,
                    email: vendor.email,
                    _id: vendor._id,
                };
            }
        }

        let cancelledByInfo = null;
        if (ticket.cancelledBy) {
            const cancelledByUser = await payservedb.User.findById(ticket.cancelledBy);
            if (cancelledByUser) {
                cancelledByInfo = {
                    fullName: cancelledByUser.fullName,
                    phoneNumber: cancelledByUser.phoneNumber,
                    email: cancelledByUser.email,
                };
            }
        }

        // Fetch reopened by user info if exists
        let reopenedByInfo = null;
        if (ticket.reopenedBy) {
            const reopenedByUser = await payservedb.User.findById(ticket.reopenedBy);
            if (reopenedByUser) {
                reopenedByInfo = {
                    fullName: reopenedByUser.fullName,
                    phoneNumber: reopenedByUser.phoneNumber,
                    email: reopenedByUser.email,
                };
            }
        }

        // Attach requester info to the ticket
        const ticketWithRequesterInfo = {
            ...ticket.toObject(),
            RequesterInfo: requesterInfo,
            isStaff,
            assignedEmployeeInfo,
            assignedVendorInfo,
            cancelledByInfo,
            reopenedByInfo
        };

        return reply.code(200).send({ message: 'Ticket retrieved successfully', ticket: ticketWithRequesterInfo });
    } catch (err) {
        console.error('Error in retrieving ticket:', err);
        return reply.code(400).send({ error: err.message });
    }
}

module.exports = GetTicket;


