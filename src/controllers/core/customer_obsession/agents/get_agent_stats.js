const payservedb = require("payservedb");
const logger = require("../../../../../config/winston");

const get_agent_stats = async (request, reply) => {
  try {
    const { facility_id, department } = request.query;

    // Build query filters for agents
    let agentQuery = {};

    if (facility_id) {
      agentQuery.facility_id = facility_id;
    }

    if (department) {
      agentQuery.department = department;
    }

    // Get total agent count
    const totalAgents = await payservedb.Agent.countDocuments(agentQuery);

    // Get agents by status
    const activeAgents = await payservedb.Agent.countDocuments({
      ...agentQuery,
      status: 'active'
    });

    const inactiveAgents = await payservedb.Agent.countDocuments({
      ...agentQuery,
      status: 'inactive'
    });

    const suspendedAgents = await payservedb.Agent.countDocuments({
      ...agentQuery,
      status: 'suspended'
    });

    // Get agents by department
    const departmentStats = await payservedb.Agent.aggregate([
      { $match: agentQuery },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get agents by role
    const roleStats = await payservedb.Agent.aggregate([
      { $match: agentQuery },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get agent User IDs (tickets reference User._id, not Agent._id)
    const agents = await payservedb.Agent.find(agentQuery).select('user_id').lean();
    const userIds = agents.map(a => a.user_id).filter(id => id); // Filter out null/undefined

    logger.info(`Found ${agents.length} agents with ${userIds.length} valid user IDs`);

    // Build ticket query
    let ticketQuery = {};
    if (userIds.length > 0) {
      ticketQuery.assigned_agent_id = { $in: userIds };
    }

    if (facility_id) {
      ticketQuery.facility_id = facility_id;
    }

    // Get total ticket count
    const totalTicketsCount = await payservedb.CustomerTicket.countDocuments(ticketQuery);
    logger.info(`Total tickets matching query: ${totalTicketsCount}`);

    // Get comprehensive ticket statistics
    const ticketStats = await payservedb.CustomerTicket.aggregate([
      { $match: ticketQuery },
      {
        $facet: {
          // Overall stats
          overall: [
            {
              $group: {
                _id: null,
                totalTickets: { $sum: 1 },
                resolvedTickets: {
                  $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] }
                },
                openTickets: {
                  $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
                },
                inProgressTickets: {
                  $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
                },
                avgRating: { $avg: '$customer_rating' }
              }
            }
          ],
          // Tickets for time calculations
          timeMetrics: [
            {
              $match: {
                $or: [
                  { resolved_at: { $exists: true, $ne: null } },
                  { status: { $in: ['resolved', 'closed'] } }
                ]
              }
            },
            {
              $project: {
                created_at: 1,
                resolved_at: 1,
                sla_due_date: 1,
                sla_status: 1,
                first_response_time: 1,
                resolution_time: 1
              }
            }
          ],
          // SLA metrics
          slaMetrics: [
            {
              $match: {
                status: { $in: ['resolved', 'closed'] }
              }
            },
            {
              $group: {
                _id: null,
                totalResolved: { $sum: 1 },
                withinSLA: {
                  $sum: {
                    $cond: [
                      { $eq: ['$sla_status', 'within_sla'] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    // Process ticket statistics
    let performanceMetrics = {
      avgTicketsHandled: 0,
      avgTicketsResolved: 0,
      avgResponseTime: 0,
      avgResolutionTime: 0,
      avgSatisfactionScore: 0,
      avgSlaCompliance: 0,
      ticketMetrics: {
        total: 0,
        resolved: 0,
        open: 0,
        inProgress: 0
      }
    };

    if (ticketStats.length > 0) {
      const stats = ticketStats[0];

      // Overall metrics
      if (stats.overall.length > 0) {
        const overall = stats.overall[0];
        const agentCount = userIds.length > 0 ? userIds.length : 1;

        performanceMetrics.avgTicketsHandled = Math.round(overall.totalTickets / agentCount);
        performanceMetrics.avgTicketsResolved = Math.round(overall.resolvedTickets / agentCount);
        performanceMetrics.ticketMetrics = {
          total: overall.totalTickets,
          resolved: overall.resolvedTickets,
          open: overall.openTickets,
          inProgress: overall.inProgressTickets
        };
      }

      // Time metrics
      if (stats.timeMetrics.length > 0) {
        let totalResponseTime = 0;
        let totalResolutionTime = 0;
        let responseCount = 0;
        let resolutionCount = 0;

        stats.timeMetrics.forEach(ticket => {
          // Use pre-calculated first_response_time if available (in minutes)
          if (ticket.first_response_time != null && ticket.first_response_time > 0) {
            totalResponseTime += ticket.first_response_time;
            responseCount++;
          }

          // Use pre-calculated resolution_time if available (in minutes)
          if (ticket.resolution_time != null && ticket.resolution_time > 0) {
            totalResolutionTime += ticket.resolution_time;
            resolutionCount++;
          } else if (ticket.resolved_at && ticket.created_at) {
            // Calculate if not pre-calculated
            const resTime = (new Date(ticket.resolved_at) - new Date(ticket.created_at)) / (1000 * 60);
            totalResolutionTime += resTime;
            resolutionCount++;
          }
        });

        performanceMetrics.avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
        performanceMetrics.avgResolutionTime = resolutionCount > 0 ? Math.round(totalResolutionTime / resolutionCount) : 0;
      }

      // SLA metrics
      if (stats.slaMetrics.length > 0 && stats.slaMetrics[0].totalResolved > 0) {
        const sla = stats.slaMetrics[0];
        performanceMetrics.avgSlaCompliance = Math.round((sla.withinSLA / sla.totalResolved) * 100);
      }
    }

    // Get survey satisfaction scores from CustomerSatisfactionSurvey
    let surveyMetrics = {
      avgCSAT: 0,
      avgNPS: 0,
      totalSurveys: 0,
      responseRate: 0,
      detailedRatings: {
        overallSatisfaction: 0,
        resolutionQuality: 0,
        responseTime: 0,
        agentProfessionalism: 0,
        agentKnowledge: 0,
        communicationClarity: 0
      }
    };

    try {
      let surveyQuery = { status: 'completed' };

      if (userIds.length > 0) {
        surveyQuery.assigned_agent_id = { $in: userIds };
      }

      if (facility_id) {
        surveyQuery.facility_id = facility_id;
      }

      const surveyStats = await payservedb.CustomerSatisfactionSurvey.aggregate([
        { $match: surveyQuery },
        {
          $group: {
            _id: null,
            avgOverallSatisfaction: { $avg: '$overall_satisfaction' },
            avgResolutionQuality: { $avg: '$resolution_quality' },
            avgResponseTimeSatisfaction: { $avg: '$response_time_satisfaction' },
            avgAgentProfessionalism: { $avg: '$agent_professionalism' },
            avgAgentKnowledge: { $avg: '$agent_knowledge' },
            avgCommunicationClarity: { $avg: '$communication_clarity' },
            avgWouldRecommend: { $avg: '$would_recommend' },
            totalSurveys: { $sum: 1 }
          }
        }
      ]);

      if (surveyStats.length > 0) {
        const stats = surveyStats[0];

        // Store detailed ratings
        surveyMetrics.detailedRatings = {
          overallSatisfaction: parseFloat((stats.avgOverallSatisfaction || 0).toFixed(2)),
          resolutionQuality: parseFloat((stats.avgResolutionQuality || 0).toFixed(2)),
          responseTime: parseFloat((stats.avgResponseTimeSatisfaction || 0).toFixed(2)),
          agentProfessionalism: parseFloat((stats.avgAgentProfessionalism || 0).toFixed(2)),
          agentKnowledge: parseFloat((stats.avgAgentKnowledge || 0).toFixed(2)),
          communicationClarity: parseFloat((stats.avgCommunicationClarity || 0).toFixed(2))
        };

        // Calculate average CSAT from all 5-star ratings
        const csatRatings = [
          stats.avgOverallSatisfaction,
          stats.avgResolutionQuality,
          stats.avgResponseTimeSatisfaction,
          stats.avgAgentProfessionalism,
          stats.avgAgentKnowledge,
          stats.avgCommunicationClarity
        ].filter(val => val != null && val > 0);

        surveyMetrics.avgCSAT = csatRatings.length > 0
          ? parseFloat((csatRatings.reduce((sum, val) => sum + val, 0) / csatRatings.length).toFixed(2))
          : 0;

        surveyMetrics.avgNPS = parseFloat((stats.avgWouldRecommend || 0).toFixed(2));
        surveyMetrics.totalSurveys = stats.totalSurveys || 0;

        // Calculate response rate
        if (performanceMetrics.ticketMetrics.resolved > 0) {
          surveyMetrics.responseRate = Math.round((surveyMetrics.totalSurveys / performanceMetrics.ticketMetrics.resolved) * 100);
        }

        logger.info(`Survey stats: CSAT=${surveyMetrics.avgCSAT}, NPS=${surveyMetrics.avgNPS}, Count=${surveyMetrics.totalSurveys}`);
      }
    } catch (surveyError) {
      logger.error(`Error fetching survey stats: ${surveyError.message}`);
    }

    // Use survey CSAT if available, otherwise fall back to old customer_rating
    performanceMetrics.avgSatisfactionScore = surveyMetrics.avgCSAT > 0
      ? surveyMetrics.avgCSAT
      : (ticketStats[0]?.overall[0]?.avgRating || 0);

    // Add survey metrics to performance
    performanceMetrics.surveyMetrics = surveyMetrics;

    logger.info(`Final performance metrics: Tickets=${performanceMetrics.avgTicketsHandled}, CSAT=${performanceMetrics.avgSatisfactionScore}, SLA=${performanceMetrics.avgSlaCompliance}%`);

    const responseData = {
      summary: {
        totalAgents,
        activeAgents,
        inactiveAgents,
        suspendedAgents,
        availableAgents: await payservedb.Agent.countDocuments({
          ...agentQuery,
          status: 'active',
          is_available: true
        })
      },
      departmentBreakdown: departmentStats,
      roleBreakdown: roleStats,
      performance: performanceMetrics
    };

    return reply.code(200).send({
      success: true,
      data: responseData
    });

  } catch (err) {
    logger.error(`Error in get_agent_stats: ${err.message}`, { stack: err.stack });
    console.error(err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = get_agent_stats;
