const db = require('payservedb');
const logger = require('../../../../../config/winston');

const deleteArticle = async (request, reply) => {
    try {
        const { article_id } = request.params;

        // Validate article_id
        if (!article_id) {
            return reply.code(400).send({
                success: false,
                error: 'Article ID is required'
            });
        }

        // Find existing article
        const existingArticle = await db.KnowledgeBase.findById(article_id);
        if (!existingArticle) {
            return reply.code(404).send({
                success: false,
                error: 'Knowledge base article not found'
            });
        }

        // Check if article is already archived
        if (existingArticle.status === 'archived') {
            return reply.code(400).send({
                success: false,
                error: 'Article is already archived'
            });
        }

        // Archive the article (soft delete only - no permanent delete allowed)
        const archivedArticle = await db.KnowledgeBase.findByIdAndUpdate(
            article_id,
            {
                status: 'archived',
                updated_by: request.user.userId,
                updated_at: new Date(),
                archived_at: new Date(),
                archived_by: request.user.userId
            },
            { new: true }
        );

        logger.info(`Knowledge base article archived: ${article_id} (${existingArticle.title}) by user ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Knowledge base article archived successfully',
            data: {
                article: archivedArticle,
                archived: true
            }
        });

    } catch (error) {
        logger.error(`Error archiving knowledge base article: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to archive knowledge base article'
        });
    }
};

module.exports = deleteArticle;
