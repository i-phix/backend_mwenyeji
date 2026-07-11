const db = require('payservedb');
const logger = require("../../../config/winston");

const getDashboard = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const userType = request.user.type;

        // Verify user is customer support agent
        if (userType !== 'Customer_Support') {
            return reply.code(403).send({
                error: "Access denied. Customer Support agents only."
            });
        }

        // Get agent information - create if doesn't exist
        let agentInfo = await db.Agent.findOne({ user_id: userId });
        if (!agentInfo) {
            // Auto-create agent record for this user
            const user = await db.User.findById(userId);
            if (!user) {
                return reply.code(404).send({
                    error: "User not found"
                });
            }

            agentInfo = await db.Agent.create({
                user_id: userId,
                agent_id: `AGT-${Date.now()}`,
                role: 'agent',
                department: user.department || 'General',
                status: 'active',
                is_available: true
            });

            logger.info(`Auto-created agent record for user ${userId}`);
        }

        // Get dashboard metrics
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));

        // Use agentInfo._id for ticket queries since tickets are assigned to agent records, not user records
        const agentId = agentInfo._id;
        logger.info(`Fetching dashboard for agentInfo._id: ${agentId}, userId: ${userId}, agent_id: ${agentInfo.agent_id}`);
        logger.info(`Full agentInfo: ${JSON.stringify(agentInfo, null, 2)}`);

        const openTickets = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: 'open'
        });
        logger.info(`Open tickets: ${openTickets}`);

        const inProgressTickets = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: 'in_progress'
        });
        logger.info(`In progress tickets: ${inProgressTickets}`);

        const resolvedToday = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: 'resolved',
            resolved_at: { $gte: startOfDay, $lt: endOfDay }
        });
        logger.info(`Resolved today: ${resolvedToday}`);

        const closedTickets = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: 'closed'
        });
        logger.info(`Closed tickets: ${closedTickets}`);

        const overdueTickets = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: { $in: ['open', 'in_progress'] },
            sla_due_date: { $lt: new Date() }
        });
        logger.info(`Overdue tickets: ${overdueTickets}`);

        // Get recent tickets - Try with user_id first since tickets might be assigned to user, not agent
        logger.info(`Querying recent tickets with userId: ${userId} and agentId: ${agentId}`);
        let recentTickets = await db.CustomerTicket.find({
            assigned_agent_id: userId  // Try userId first
        })
        .sort({ created_at: -1 })
        .limit(10)
        .populate('customer_id', 'firstName lastName fullName email phoneNumber')
        .populate('category_id', 'name priority color')
        .lean();

        logger.info(`Found ${recentTickets.length} recent tickets with userId`);

        // If no tickets found with userId, try with agentId
        if (recentTickets.length === 0) {
            logger.info(`Trying with agentId: ${agentId}`);
            recentTickets = await db.CustomerTicket.find({
                assigned_agent_id: agentId
            })
            .sort({ created_at: -1 })
            .limit(10)
            .populate('customer_id', 'firstName lastName fullName email phoneNumber')
            .populate('category_id', 'name priority color')
            .lean();
            logger.info(`Found ${recentTickets.length} recent tickets with agentId`);
        }

        if (recentTickets.length > 0) {
            logger.info(`Sample ticket: ${JSON.stringify(recentTickets[0], null, 2)}`);
        }

        // Calculate average response time and rating for the agent
        const resolvedTickets = await db.CustomerTicket.find({
            assigned_agent_id: agentId,
            status: { $in: ['resolved', 'closed'] },
            resolved_at: { $gte: sevenDaysAgo }
        }).select('created_at resolved_at customer_rating').lean();

        let avgResponseTime = 0;
        let avgRating = 0;
        let totalRatings = 0;

        if (resolvedTickets.length > 0) {
            const totalResponseTime = resolvedTickets.reduce((sum, ticket) => {
                if (ticket.resolved_at && ticket.created_at) {
                    return sum + (new Date(ticket.resolved_at) - new Date(ticket.created_at));
                }
                return sum;
            }, 0);
            avgResponseTime = Math.round((totalResponseTime / resolvedTickets.length) / (1000 * 60)); // Convert to minutes

            const ratingsSum = resolvedTickets.reduce((sum, ticket) => {
                if (ticket.customer_rating) {
                    totalRatings++;
                    return sum + ticket.customer_rating;
                }
                return sum;
            }, 0);
            avgRating = totalRatings > 0 ? (ratingsSum / totalRatings).toFixed(2) : 0;
        }

        // Calculate SLA compliance
        const totalTicketsWithSLA = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: { $in: ['resolved', 'closed'] },
            resolved_at: { $exists: true, $gte: sevenDaysAgo }
        });

        const slaCompliantTickets = await db.CustomerTicket.countDocuments({
            assigned_agent_id: agentId,
            status: { $in: ['resolved', 'closed'] },
            resolved_at: { $exists: true, $gte: sevenDaysAgo },
            $expr: { $lte: ['$resolved_at', '$sla_due_date'] }
        });

        const slaCompliance = totalTicketsWithSLA > 0 ? Math.round((slaCompliantTickets / totalTicketsWithSLA) * 100) : 0;

        // Get weekly stats (last 7 days)
        const weeklyStats = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i + 1);

            const dayTickets = await db.CustomerTicket.find({
                assigned_agent_id: agentId,
                status: { $in: ['resolved', 'closed'] },
                resolved_at: { $gte: dayStart, $lt: dayEnd }
            }).select('customer_rating').lean();

            const dayRatings = dayTickets.filter(t => t.customer_rating).map(t => t.customer_rating);
            const dayAvgRating = dayRatings.length > 0 ? (dayRatings.reduce((a, b) => a + b, 0) / dayRatings.length).toFixed(1) : 0;

            weeklyStats.push({
                day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                tickets: dayTickets.length,
                rating: parseFloat(dayAvgRating)
            });
        }

        const dashboardData = {
            agent: {
                agent_id: agentInfo.agent_id,
                role: agentInfo.role,
                department: agentInfo.department,
                team_id: agentInfo.team_id,
                status: agentInfo.status,
                is_available: agentInfo.is_available
            },
            tickets: {
                open: openTickets,
                in_progress: inProgressTickets,
                resolved_today: resolvedToday,
                closed: closedTickets,
                overdue: overdueTickets
            },
            performance: {
                avg_response_time: avgResponseTime,
                average_rating: avgRating,
                sla_compliance: slaCompliance,
                weekly_stats: weeklyStats
            },
            recent_tickets: (recentTickets || []).map(ticket => {
                const customer = ticket.customer_id;
                let customerName = 'Unknown';

                if (customer) {
                    if (customer.fullName && customer.fullName !== customer.email) {
                        customerName = customer.fullName;
                    } else {
                        const firstName = customer.firstName || '';
                        const lastName = customer.lastName || '';
                        const name = `${firstName} ${lastName}`.trim();
                        customerName = name || 'Unknown';
                    }
                }

                return {
                    ticket_id: ticket.ticket_number,
                    customer_name: customerName,
                    subject: ticket.title,
                    priority: ticket.category_id?.priority || 'medium',
                    status: ticket.status,
                    created_at: ticket.created_at
                };
            })
        };

        logger.info(`Dashboard data retrieved for agent ${agentInfo.agent_id}`);
        logger.info(`Dashboard response: ${JSON.stringify(dashboardData, null, 2)}`);
        return reply.code(200).send({
            success: true,
            data: dashboardData
        });

    } catch (err) {
        logger.error(`Dashboard error: ${err.message}`);
        return reply.code(500).send({
            error: "Failed to retrieve dashboard data"
        });
    }
};

module.exports = getDashboard;