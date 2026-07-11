const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function submit_survey(request, reply) {
    try {
        const { token } = request.params;
        const surveyData = request.body;

        // Validate token
        if (!token) {
            return reply.code(400).send({
                success: false,
                error: 'Survey token is required'
            });
        }

        // Find survey by token
        const survey = await payservedb.CustomerSatisfactionSurvey.findOne({
            survey_token: token
        }).populate('ticket_id', 'ticket_number title description')
          .populate('customer_id', 'fullName firstName lastName')
          .populate('assigned_agent_id', 'fullName firstName lastName');

        if (!survey) {
            return reply.code(404).send({
                success: false,
                error: 'Survey not found. The survey link may be invalid.'
            });
        }

        // Check if survey is already completed
        if (survey.status === 'completed') {
            return reply.code(400).send({
                success: false,
                error: 'This survey has already been completed. Thank you for your feedback!'
            });
        }

        // Check if survey is expired
        if (survey.isExpired()) {
            await payservedb.CustomerSatisfactionSurvey.findByIdAndUpdate(survey._id, {
                status: 'expired'
            });

            return reply.code(400).send({
                success: false,
                error: 'This survey has expired. Survey links are valid for 7 days.'
            });
        }

        // Validate required fields
        const {
            overall_satisfaction,
            resolution_quality,
            response_time_satisfaction,
            agent_professionalism,
            agent_knowledge,
            communication_clarity,
            would_recommend,
            facility_maintenance,
            value_for_money,
            ease_of_contact,
            positive_feedback,
            improvement_feedback,
            additional_comments,
            issue_fully_resolved,
            issue_resolution_details
        } = surveyData;

        // At least one rating must be provided
        if (!overall_satisfaction && !resolution_quality && !would_recommend) {
            return reply.code(400).send({
                success: false,
                error: 'Please provide at least an overall satisfaction rating'
            });
        }

        // Validate rating ranges
        const ratings = [
            { name: 'overall_satisfaction', value: overall_satisfaction, min: 1, max: 5 },
            { name: 'resolution_quality', value: resolution_quality, min: 1, max: 5 },
            { name: 'response_time_satisfaction', value: response_time_satisfaction, min: 1, max: 5 },
            { name: 'agent_professionalism', value: agent_professionalism, min: 1, max: 5 },
            { name: 'agent_knowledge', value: agent_knowledge, min: 1, max: 5 },
            { name: 'communication_clarity', value: communication_clarity, min: 1, max: 5 },
            { name: 'would_recommend', value: would_recommend, min: 0, max: 10 },
            { name: 'facility_maintenance', value: facility_maintenance, min: 0, max: 5 },
            { name: 'value_for_money', value: value_for_money, min: 0, max: 5 },
            { name: 'ease_of_contact', value: ease_of_contact, min: 0, max: 5 }
        ];

        for (const rating of ratings) {
            if (rating.value !== undefined && rating.value !== null) {
                if (rating.value < rating.min || rating.value > rating.max) {
                    return reply.code(400).send({
                        success: false,
                        error: `${rating.name} must be between ${rating.min} and ${rating.max}`
                    });
                }
            }
        }

        // Calculate response time (time from survey sent to now)
        const responseTimeSeconds = Math.floor((new Date() - survey.sent_at) / 1000);

        // Capture request metadata
        const ipAddress = request.headers['x-forwarded-for'] ||
                         request.headers['x-real-ip'] ||
                         request.ip ||
                         request.socket.remoteAddress;
        const userAgent = request.headers['user-agent'];

        // Update survey with responses
        const updatedSurvey = await payservedb.CustomerSatisfactionSurvey.findByIdAndUpdate(
            survey._id,
            {
                overall_satisfaction,
                resolution_quality,
                response_time_satisfaction,
                agent_professionalism,
                agent_knowledge,
                communication_clarity,
                would_recommend,
                facility_maintenance,
                value_for_money,
                ease_of_contact,
                positive_feedback,
                improvement_feedback,
                additional_comments,
                issue_fully_resolved,
                issue_resolution_details,
                status: 'completed',
                completed_at: new Date(),
                response_time_seconds: responseTimeSeconds,
                ip_address: ipAddress,
                user_agent: userAgent
            },
            { new: true }
        );

        // Log successful survey submission
        const customerName = survey.customer_id?.fullName ||
                           `${survey.customer_id?.firstName || ''} ${survey.customer_id?.lastName || ''}`.trim() ||
                           'Customer';

        logger.info(`Customer satisfaction survey completed for ticket ${survey.ticket_number} by ${customerName}`);
        logger.info(`Survey results - Overall: ${overall_satisfaction}/5, NPS: ${would_recommend}/10, Issue Resolved: ${issue_fully_resolved}`);

        // If customer indicated issue is not fully resolved, consider creating a follow-up task or notification
        if (issue_fully_resolved === false) {
            logger.warn(`Customer reported issue NOT fully resolved for ticket ${survey.ticket_number}: ${issue_resolution_details}`);

            // Optionally: Create a notification for the assigned agent
            if (survey.assigned_agent_id) {
                try {
                    await payservedb.AgentNotification.create({
                        user_id: survey.assigned_agent_id._id,
                        type: 'survey_issue_unresolved',
                        title: 'Customer Reported Issue Not Fully Resolved',
                        message: `Customer indicated issue not fully resolved for ticket #${survey.ticket_number}`,
                        ticket_id: survey.ticket_id._id,
                        ticket_number: survey.ticket_number,
                        link: `/agent/tickets/${survey.ticket_id._id}`,
                        metadata: {
                            survey_id: survey._id,
                            issue_resolution_details: issue_resolution_details,
                            overall_satisfaction: overall_satisfaction,
                            would_recommend: would_recommend
                        }
                    });

                    logger.info(`Agent notification created for unresolved issue on ticket ${survey.ticket_number}`);
                } catch (notificationError) {
                    logger.error(`Failed to create agent notification: ${notificationError.message}`);
                }
            }
        }

        // Return success response
        return reply.code(200).send({
            success: true,
            message: 'Thank you for your feedback! Your response has been recorded successfully.',
            data: {
                survey_id: updatedSurvey._id,
                ticket_number: survey.ticket_number,
                completed_at: updatedSurvey.completed_at,
                nps_category: updatedSurvey.nps_category,
                average_rating: updatedSurvey.average_rating
            }
        });

    } catch (error) {
        console.error('Error submitting survey:', error);
        logger.error(`Error submitting survey: ${error.message}`, { stack: error.stack });

        return reply.code(500).send({
            success: false,
            error: 'Failed to submit survey. Please try again later.'
        });
    }
}

module.exports = submit_survey;
