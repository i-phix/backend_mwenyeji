const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const getSurveys = async (request, reply) => {
    try {
        const { type, status, search, page = 1, limit = 50 } = request.query;

        // Build filter
        const filter = {};

        if (type) {
            filter.survey_type = type;
        }

        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.$or = [
                { survey_name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Use CustomerSatisfactionSurvey model
        let surveys = [];
        let totalSurveys = 0;

        if (payservedb.CustomerSatisfactionSurvey) {
            const rawSurveys = await payservedb.CustomerSatisfactionSurvey.find(filter)
                .populate('customer_id', 'firstName lastName fullName email phoneNumber phone')
                .populate('ticket_id', 'ticket_number title')
                .populate('assigned_agent_id', 'firstName lastName fullName email')
                .populate('facility_id', 'name')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean();

            // Map to expected format for frontend
            surveys = rawSurveys.map(survey => ({
                _id: survey._id,
                survey_id: survey.ticket_number || survey._id.toString().substring(0, 8),
                survey_type: 'post_resolution', // All surveys are post-resolution
                customer_id: survey.customer_id,
                agent_id: survey.assigned_agent_id,
                facility_id: survey.facility_id,
                ticket_id: survey.ticket_id,
                status: survey.status,
                // NPS Score (would_recommend 0-10)
                nps_score: survey.would_recommend,
                nps_category: survey.would_recommend != null
                    ? (survey.would_recommend >= 9 ? 'Promoter' : survey.would_recommend >= 7 ? 'Passive' : 'Detractor')
                    : null,
                // CSAT Score (overall_satisfaction 1-5)
                csat_score: survey.overall_satisfaction,
                // Overall rating - average of all ratings
                overall_rating: survey.overall_satisfaction,
                // Agent rating - average of agent-specific ratings
                agent_rating: survey.agent_professionalism && survey.agent_knowledge
                    ? ((survey.agent_professionalism + survey.agent_knowledge) / 2)
                    : null,
                // Feedback text - combine all text fields
                feedback_text: [
                    survey.positive_feedback,
                    survey.improvement_feedback,
                    survey.additional_comments
                ].filter(Boolean).join(' | '),
                // Survey channel
                survey_channel: 'email',
                // Timestamps
                sent_at: survey.sent_at,
                opened_at: null, // Not tracked yet
                completed_at: survey.completed_at,
                expires_at: survey.expired_at,
                created_at: survey.created_at,
                updated_at: survey.updated_at
            }));

            totalSurveys = await payservedb.CustomerSatisfactionSurvey.countDocuments(filter);
        } else {
            // Return empty array if model doesn't exist
            logger.warn('CustomerSatisfactionSurvey model not found in database');
        }

        logger.info(`Retrieved ${surveys.length} surveys`);

        return reply.code(200).send({
            success: true,
            data: surveys,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_items: totalSurveys,
                total_pages: Math.ceil(totalSurveys / parseInt(limit))
            }
        });

    } catch (err) {
        logger.error(`Error retrieving surveys: ${err.message}`, { stack: err.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve surveys'
        });
    }
};

module.exports = getSurveys;
