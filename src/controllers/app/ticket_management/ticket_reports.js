const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetTicketsReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Get all tickets for the facility
        const tickets = await ticketModel.find({});

        if (!tickets || tickets.length === 0) {
            return reply.code(404).send({ message: 'No tickets found for this facility.' });
        }

        // Initialize status counters
        const statusCounts = {
            'open': 0,
            'under review': 0,
            'ongoing': 0,
            'resolved': 0,
            'cancelled': 0,
            'closed': 0
        };

        // Initialize other counters and arrays
        let totalAmount = 0;
        let highPriorityCount = 0;
        let mediumPriorityCount = 0;
        let lowPriorityCount = 0;
        let maintenanceTickets = 0;
        let needsFixCount = 0;
        const ticketTypes = {};
        const payerTypes = {};

        // Process each ticket
        tickets.forEach(ticket => {
            // Count by status
            if (statusCounts.hasOwnProperty(ticket.status)) {
                statusCounts[ticket.status]++;
            }

            // Sum total amounts (only if totalAmount exists and is a number)
            if (ticket.totalAmount && typeof ticket.totalAmount === 'number') {
                totalAmount += ticket.totalAmount;
            }

            // Count by priority
            if (ticket.priority) {
                switch (ticket.priority.toLowerCase()) {
                    case 'high':
                        highPriorityCount++;
                        break;
                    case 'medium':
                        mediumPriorityCount++;
                        break;
                    case 'low':
                        lowPriorityCount++;
                        break;
                }
            }

            // Count ticket types
            if (ticket.ticketType) {
                ticketTypes[ticket.ticketType] = (ticketTypes[ticket.ticketType] || 0) + 1;
                if (ticket.ticketType.toLowerCase() === 'maintenance') {
                    maintenanceTickets++;
                }
            }

            // Count payer types
            if (ticket.payerType) {
                payerTypes[ticket.payerType] = (payerTypes[ticket.payerType] || 0) + 1;
            }

            // Count tickets that need fixing
            if (ticket.needsFix === 'yes') {
                needsFixCount++;
            }
        });

        // Calculate percentages
        const totalTickets = tickets.length;
        const statusPercentages = {};
        Object.keys(statusCounts).forEach(status => {
            statusPercentages[status] = totalTickets > 0 ?
                Math.round((statusCounts[status] / totalTickets) * 100) : 0;
        });

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentTickets = tickets.filter(ticket =>
            ticket.createdAt && new Date(ticket.createdAt) >= sevenDaysAgo
        ).length;

        // Build comprehensive report
        const report = {
            facilityId,
            generatedAt: new Date().toISOString(),
            summary: {
                totalTickets,
                recentTickets: recentTickets,
                totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
                needsFixCount
            },
            statusBreakdown: {
                counts: statusCounts,
                percentages: statusPercentages
            },
            priorityBreakdown: {
                high: highPriorityCount,
                medium: mediumPriorityCount,
                low: lowPriorityCount
            },
            ticketTypeBreakdown: ticketTypes,
            payerTypeBreakdown: payerTypes,
            insights: {
                mostCommonStatus: Object.keys(statusCounts).reduce((a, b) =>
                    statusCounts[a] > statusCounts[b] ? a : b
                ),
                mostCommonTicketType: Object.keys(ticketTypes).length > 0 ?
                    Object.keys(ticketTypes).reduce((a, b) =>
                        ticketTypes[a] > ticketTypes[b] ? a : b
                    ) : 'N/A',
                highPriorityPercentage: totalTickets > 0 ?
                    Math.round((highPriorityCount / totalTickets) * 100) : 0,
                averageAmount: totalTickets > 0 ?
                    Math.round((totalAmount / totalTickets) * 100) / 100 : 0,
                needsFixPercentage: totalTickets > 0 ?
                    Math.round((needsFixCount / totalTickets) * 100) : 0
            }
        };

        return reply.code(200).send({
            message: 'Tickets report generated successfully',
            report
        });

    } catch (err) {
        console.error('Error generating tickets report:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = GetTicketsReport;