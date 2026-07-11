const db = require('payservedb');
const logger = require('../../../../config/winston');

const rateArticle = async (request, reply) => {
    try {
        const { article_id } = request.params;
        const { helpful } = request.body; // true for helpful, false for not helpful

        // Validate input
        if (!article_id) {
            return reply.code(400).send({
                success: false,
                error: 'Article ID is required'
            });
        }

        if (typeof helpful !== 'boolean') {
            return reply.code(400).send({
                success: false,
                error: 'Helpful rating must be true or false'
            });
        }

        // Check if article exists and is published
        const article = await db.KnowledgeBase.findOne({
            _id: article_id,
            status: 'published'
        });

        if (!article) {
            return reply.code(404).send({
                success: false,
                error: 'Knowledge base article not found or not published'
            });
        }

        // Check if agent has already rated this article
        const existingRating = await db.KnowledgeBaseRating.findOne({
            article_id: article_id,
            agent_id: request.user.userId
        });

        if (existingRating) {
            return reply.code(400).send({
                success: false,
                error: 'You have already rated this article'
            });
        }

        // Create rating record
        const rating = new db.KnowledgeBaseRating({
            article_id: article_id,
            agent_id: request.user.userId,
            helpful: helpful,
            created_at: new Date()
        });

        await rating.save();

        // Update article counters
        const updateField = helpful ? 'helpful_count' : 'not_helpful_count';
        const updatedArticle = await db.KnowledgeBase.findByIdAndUpdate(
            article_id,
            { $inc: { [updateField]: 1 } },
            { new: true }
        ).select('helpful_count not_helpful_count');

        logger.info(`Agent rated knowledge base article: ${article_id} as ${helpful ? 'helpful' : 'not helpful'} by agent ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Article rating submitted successfully',
            data: {
                article_id,
                helpful,
                helpful_count: updatedArticle.helpful_count,
                not_helpful_count: updatedArticle.not_helpful_count
            }
        });

    } catch (error) {
        logger.error(`Error rating knowledge base article: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to rate article'
        });
    }
};

module.exports = rateArticle;