const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function get_survey(request, reply) {
    try {
        const { token } = request.params;

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
        }).populate('ticket_id', 'ticket_number title description category_id created_at resolved_at')
          .populate({
              path: 'ticket_id',
              populate: {
                  path: 'category_id',
                  select: 'name priority'
              }
          })
          .populate('customer_id', 'fullName firstName lastName email phoneNumber')
          .populate('assigned_agent_id', 'fullName firstName lastName')
          .populate('facility_id', 'name');

        if (!survey) {
            return reply.code(404).send({
                success: false,
                error: 'Survey not found',
                message: 'The survey link may be invalid or has been removed.'
            });
        }

        // Check if survey is already completed
        if (survey.status === 'completed') {
            return reply.code(200).send({
                success: false,
                status: 'completed',
                message: 'This survey has already been completed. Thank you for your feedback!',
                data: {
                    ticket_number: survey.ticket_number,
                    completed_at: survey.completed_at,
                    overall_satisfaction: survey.overall_satisfaction,
                    would_recommend: survey.would_recommend
                }
            });
        }

        // Check if survey is expired
        if (survey.isExpired()) {
            await payservedb.CustomerSatisfactionSurvey.findByIdAndUpdate(survey._id, {
                status: 'expired'
            });

            return reply.code(200).send({
                success: false,
                status: 'expired',
                message: 'This survey has expired. Survey links are valid for 7 days after ticket resolution.',
                data: {
                    ticket_number: survey.ticket_number,
                    expired_at: survey.expired_at
                }
            });
        }

        // Return survey details for the form
        const customerName = survey.customer_id?.fullName ||
                           `${survey.customer_id?.firstName || ''} ${survey.customer_id?.lastName || ''}`.trim() ||
                           'Valued Customer';

        const agentName = survey.assigned_agent_id?.fullName ||
                         `${survey.assigned_agent_id?.firstName || ''} ${survey.assigned_agent_id?.lastName || ''}`.trim() ||
                         'Support Agent';

        return reply.code(200).send({
            success: true,
            status: 'pending',
            data: {
                survey_id: survey._id,
                ticket_number: survey.ticket_number,
                ticket_title: survey.ticket_id?.title,
                ticket_description: survey.ticket_id?.description,
                category: survey.ticket_id?.category_id?.name,
                customer_name: customerName,
                agent_name: agentName,
                facility_name: survey.facility_id?.name,
                sent_at: survey.sent_at,
                expires_at: survey.expired_at,
                days_until_expiry: Math.ceil((new Date(survey.expired_at) - new Date()) / (1000 * 60 * 60 * 24))
            }
        });

    } catch (error) {
        console.error('Error retrieving survey:', error);
        logger.error(`Error retrieving survey: ${error.message}`, { stack: error.stack });

        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve survey. Please try again later.'
        });
    }
}

module.exports = get_survey;
