const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const CancelTicket = async (request, reply) => {
    try {
        const { ticketId, facilityId } = request.params;
        const { cancellationReason, cancelledBy } = request.body;

        // Get the ticket model for the facility
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find and update the ticket
        const updatedTicket = await ticketModel.findByIdAndUpdate(
            ticketId,
            {
                status: 'cancelled',
                cancellationReason,
                cancelledAt: new Date(),
                cancelledBy
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
            message: 'Ticket cancelled successfully',
            data: updatedTicket
        });
    } catch (err) {
        console.error('Error in cancelling ticket:', err);
        return reply.code(400).send({ 
            success: false, 
            error: err.message 
        });
    }
}

module.exports = CancelTicket;