const db = require('payservedb');
const logger = require('../../../../../config/winston');

const getArticle = async (request, reply) => {
    try {
        const { article_id } = request.params;

        // Validate article_id
        if (!article_id) {
            return reply.code(400).send({
                success: false,
                error: 'Article ID is required'
            });
        }

        // Find article by ID
        const article = await db.KnowledgeBase.findById(article_id)
            .populate('author_id', 'fullName email')
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email')
            .lean();

        if (!article) {
            return reply.code(404).send({
                success: false,
                error: 'Knowledge base article not found'
            });
        }

        // Get related articles (same category, excluding current article)
        const relatedArticles = await db.KnowledgeBase.find({
            category: article.category,
            _id: { $ne: article_id },
            status: 'published'
        })
            .select('title summary category created_at views_count helpful_count')
            .sort({ helpful_count: -1, views_count: -1 })
            .limit(5)
            .lean();

        logger.info(`Knowledge base article retrieved: ${article_id}`);

        return reply.code(200).send({
            success: true,
            data: {
                article,
                related_articles: relatedArticles
            }
        });

    } catch (error) {
        logger.error(`Error retrieving knowledge base article: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve knowledge base article'
        });
    }
};

module.exports = getArticle;