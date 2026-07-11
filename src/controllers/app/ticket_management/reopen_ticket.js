const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const ReopenTicket = async (request, reply) => {
    try {
        const { ticketId, facilityId } = request.params;
        const { reopenedReason, reopenedBy } = request.body;

        // Get the ticket model for the facility
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find and update the ticket
        const updatedTicket = await ticketModel.findByIdAndUpdate(
            ticketId,
            {
                status: 'open', // Reset to open status
                reopenedReason,
                reopenedAt: new Date(),
                reopenedBy,
                $inc: { reopenCount: 1 }
            },
            { new: true }
        );

        if (!updatedTicket) {
            return reply.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        return reply.status(200).send({
            success: true,
            message: 'Ticket reopened successfully',
            data: updatedTicket
        });
    } catch (err) {
        console.error('Error in reopening ticket:', err);
        return reply.code(400).send({
            success: false,
            error: err.message
        });
    }
}

module.exports = ReopenTicket;