const db = require('payservedb');
const logger = require('../../../../../config/winston');

const updateArticle = async (request, reply) => {
    try {
        const { article_id } = request.params;
        const {
            title,
            content,
            summary,
            category_id,
            tags,
            status,
            visibility,
            is_featured
        } = request.body;

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

        // Prepare update data
        const updateData = {
            updated_by: request.user.userId,
            updated_at: new Date()
        };

        if (title !== undefined) updateData.title = title.trim();
        if (content !== undefined) updateData.content = content;
        if (summary !== undefined) updateData.summary = summary.trim();
        if (category_id !== undefined) updateData.category_id = category_id;
        if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.map(tag => tag.trim()) : [];
        if (status !== undefined) updateData.status = status;
        if (visibility !== undefined) updateData.visibility = visibility;
        if (is_featured !== undefined) updateData.is_featured = is_featured;

        // Update article
        const updatedArticle = await db.KnowledgeBase.findByIdAndUpdate(
            article_id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('author_id', 'fullName email')
            .populate('updated_by', 'fullName email')
            .populate('category_id', 'name priority color');

        logger.info(`Knowledge base article updated: ${article_id} by user ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Knowledge base article updated successfully',
            data: updatedArticle
        });

    } catch (error) {
        logger.error(`Error updating knowledge base article: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to update knowledge base article'
        });
    }
};

module.exports = updateArticle;