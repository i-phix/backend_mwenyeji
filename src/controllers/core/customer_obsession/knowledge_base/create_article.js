const db = require('payservedb');
const logger = require('../../../../../config/winston');

const createArticle = async (request, reply) => {
    try {
        const {
            title,
            content,
            summary,
            category_id,
            tags,
            status = 'draft',
            visibility = 'internal',
            is_featured = false,
            author_id
        } = request.body;

        // Validation
        if (!title || !content || !category_id) {
            return reply.code(400).send({
                success: false,
                error: 'Title, content, and category are required'
            });
        }

        // Create knowledge base article
        const article = new db.KnowledgeBase({
            title: title.trim(),
            content,
            summary: summary?.trim() || '',
            category_id,
            tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
            status, // draft, published, archived
            visibility, // internal, public
            is_featured,
            author_id: author_id || request.user.userId,
            created_by: request.user.userId,
            updated_by: request.user.userId,
            created_at: new Date(),
            updated_at: new Date(),
            views_count: 0,
            helpful_count: 0,
            not_helpful_count: 0
        });

        const savedArticle = await article.save();

        logger.info(`Knowledge base article created: ${savedArticle._id} by user ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Knowledge base article created successfully',
            data: savedArticle
        });

    } catch (error) {
        logger.error(`Error creating knowledge base article: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to create knowledge base article'
        });
    }
};

module.exports = createArticle;