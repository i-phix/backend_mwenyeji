const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function get_analytics(request, reply) {
    try {
        const agent = request.user;

        // Parse query parameters
        const {
            facility_id,
            agent_id,
            start_date,
            end_date,
            time_period = '30days' // Options: 7days, 30days, 90days, all
        } = request.query;

        // Build filters
        const filters = {};

        if (facility_id) {
            filters.facility_id = facility_id;
        }

        if (agent_id) {
            filters.assigned_agent_id = agent_id;
        }

        // Set date range based on time period
        if (time_period !== 'all') {
            const now = new Date();
            let daysBack;

            switch (time_period) {
                case '7days':
                    daysBack = 7;
                    break;
                case '30days':
                    daysBack = 30;
                    break;
                case '90days':
                    daysBack = 90;
                    break;
                default:
                    daysBack = 30;
            }

            const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
            filters.start_date = startDate.toISOString();
        }

        // Override with custom date range if provided
        if (start_date) {
            filters.start_date = start_date;
        }
        if (end_date) {
            filters.end_date = end_date;
        }

        // Get analytics from the model's static method
        const analytics = await payservedb.CustomerSatisfactionSurvey.getAnalytics(filters);

        // Get additional statistics
        const match = { status: 'completed' };
        if (filters.facility_id) match.facility_id = payservedb.mongoose.Types.ObjectId(filters.facility_id);
        if (filters.agent_id) match.assigned_agent_id = payservedb.mongoose.Types.ObjectId(filters.agent_id);
        if (filters.start_date) match.completed_at = { $gte: new Date(filters.start_date) };
        if (filters.end_date) {
            match.completed_at = match.completed_at || {};
            match.completed_at.$lte = new Date(filters.end_date);
        }

        // Get total surveys sent vs completed
        const totalSent = await payservedb.CustomerSatisfactionSurvey.countDocuments({
            ...match,
            status: { $in: ['pending', 'completed', 'expired'] }
        });

        const totalCompleted = await payservedb.CustomerSatisfactionSurvey.countDocuments(match);

        const totalPending = await payservedb.CustomerSatisfactionSurvey.countDocuments({
            ...match,
            status: 'pending'
        });

        const totalExpired = await payservedb.CustomerSatisfactionSurvey.countDocuments({
            ...match,
            status: 'expired'
        });

        const completionRate = totalSent > 0 ? Math.round((totalCompleted / totalSent) * 100) : 0;

        // Get rating distribution for overall satisfaction
        const ratingDistribution = await payservedb.CustomerSatisfactionSurvey.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$overall_satisfaction',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get NPS distribution
        const npsDistribution = await payservedb.CustomerSatisfactionSurvey.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$would_recommend',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get recent feedback (last 10)
        const recentFeedback = await payservedb.CustomerSatisfactionSurvey.find(match)
            .select('ticket_number overall_satisfaction would_recommend positive_feedback improvement_feedback completed_at customer_id')
            .populate('customer_id', 'fullName firstName lastName')
            .sort({ completed_at: -1 })
            .limit(10)
            .lean();

        // Get top issues from improvement feedback
        const improvementFeedbacks = await payservedb.CustomerSatisfactionSurvey.find({
            ...match,
            improvement_feedback: { $exists: true, $ne: '' }
        })
            .select('improvement_feedback ticket_number completed_at')
            .sort({ completed_at: -1 })
            .limit(20)
            .lean();

        // Get positive testimonials (high ratings with feedback)
        const testimonials = await payservedb.CustomerSatisfactionSurvey.find({
            ...match,
            overall_satisfaction: { $gte: 4 },
            positive_feedback: { $exists: true, $ne: '' }
        })
            .select('ticket_number overall_satisfaction would_recommend positive_feedback completed_at customer_id assigned_agent_id')
            .populate('customer_id', 'fullName firstName lastName')
            .populate('assigned_agent_id', 'fullName firstName lastName')
            .sort({ completed_at: -1 })
            .limit(10)
            .lean();

        // Calculate average response time
        const responseTimeStats = await payservedb.CustomerSatisfactionSurvey.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    avg_response_time: { $avg: '$response_time_seconds' },
                    min_response_time: { $min: '$response_time_seconds' },
                    max_response_time: { $max: '$response_time_seconds' }
                }
            }
        ]);

        const responseTime = responseTimeStats.length > 0 ? {
            average_seconds: Math.round(responseTimeStats[0].avg_response_time),
            average_minutes: Math.round(responseTimeStats[0].avg_response_time / 60),
            average_hours: Math.round(responseTimeStats[0].avg_response_time / 3600),
            min_seconds: responseTimeStats[0].min_response_time,
            max_seconds: responseTimeStats[0].max_response_time
        } : null;

        logger.info(`Survey analytics retrieved by agent ${agent.fullName} with filters:`, filters);

        // Return comprehensive analytics
        return reply.code(200).send({
            success: true,
            data: {
                summary: {
                    total_sent: totalSent,
                    total_completed: totalCompleted,
                    total_pending: totalPending,
                    total_expired: totalExpired,
                    completion_rate: completionRate,
                    response_time: responseTime
                },
                ratings: {
                    avg_overall_satisfaction: analytics.avg_overall_satisfaction?.toFixed(2) || 0,
                    avg_resolution_quality: analytics.avg_resolution_quality?.toFixed(2) || 0,
                    avg_response_time_satisfaction: analytics.avg_response_time_satisfaction?.toFixed(2) || 0,
                    avg_agent_professionalism: analytics.avg_agent_professionalism?.toFixed(2) || 0,
                    avg_agent_knowledge: analytics.avg_agent_knowledge?.toFixed(2) || 0,
                    avg_communication_clarity: analytics.avg_communication_clarity?.toFixed(2) || 0
                },
                nps: {
                    score: analytics.nps_score || 0,
                    average: analytics.avg_nps?.toFixed(2) || 0,
                    promoters: analytics.promoters || 0,
                    passives: analytics.passives || 0,
                    detractors: analytics.detractors || 0,
                    distribution: npsDistribution
                },
                resolution: {
                    rate: analytics.resolution_rate || 0,
                    fully_resolved_count: analytics.fully_resolved_count || 0
                },
                rating_distribution: ratingDistribution,
                recent_feedback: recentFeedback.map(feedback => ({
                    ticket_number: feedback.ticket_number,
                    customer_name: feedback.customer_id?.fullName ||
                                  `${feedback.customer_id?.firstName || ''} ${feedback.customer_id?.lastName || ''}`.trim() ||
                                  'Anonymous',
                    overall_satisfaction: feedback.overall_satisfaction,
                    would_recommend: feedback.would_recommend,
                    positive_feedback: feedback.positive_feedback,
                    improvement_feedback: feedback.improvement_feedback,
                    completed_at: feedback.completed_at
                })),
                improvement_areas: improvementFeedbacks.map(f => ({
                    ticket_number: f.ticket_number,
                    feedback: f.improvement_feedback,
                    date: f.completed_at
                })),
                testimonials: testimonials.map(t => ({
                    ticket_number: t.ticket_number,
                    customer_name: t.customer_id?.fullName ||
                                  `${t.customer_id?.firstName || ''} ${t.customer_id?.lastName || ''}`.trim() ||
                                  'Anonymous',
                    agent_name: t.assigned_agent_id?.fullName ||
                               `${t.assigned_agent_id?.firstName || ''} ${t.assigned_agent_id?.lastName || ''}`.trim() ||
                               'Support Agent',
                    rating: t.overall_satisfaction,
                    nps: t.would_recommend,
                    feedback: t.positive_feedback,
                    date: t.completed_at
                })),
                filters_applied: filters,
                time_period: time_period
            }
        });

    } catch (error) {
        console.error('Error retrieving survey analytics:', error);
        logger.error(`Error retrieving survey analytics: ${error.message}`, { stack: error.stack });

        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve survey analytics'
        });
    }
}

module.exports = get_analytics;
