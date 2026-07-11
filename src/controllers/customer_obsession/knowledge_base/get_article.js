const db = require('payservedb');
const logger = require('../../../../config/winston');

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

        // Find article by ID - only published articles for agents
        const article = await db.KnowledgeBase.findOne({
            _id: article_id,
            status: 'published'
        })
            .select('title content summary category_id tags is_featured created_at updated_at views_count helpful_count not_helpful_count')
            .populate('author_id', 'fullName')
            .populate('category_id', 'name priority color')
            .lean();

        if (!article) {
            return reply.code(404).send({
                success: false,
                error: 'Knowledge base article not found or not published'
            });
        }

        // Increment view count
        await db.KnowledgeBase.findByIdAndUpdate(article_id, {
            $inc: { views_count: 1 }
        });

        // Get related articles (same category, excluding current article)
        const relatedArticles = await db.KnowledgeBase.find({
            category_id: article.category_id?._id || article.category_id,
            _id: { $ne: article_id },
            status: 'published'
        })
            .select('title summary category_id created_at views_count helpful_count')
            .populate('category_id', 'name priority color')
            .sort({ helpful_count: -1, views_count: -1 })
            .limit(5)
            .lean();

        // Get popular articles in the same category
        const popularArticles = await db.KnowledgeBase.find({
            category_id: article.category_id?._id || article.category_id,
            _id: { $ne: article_id },
            status: 'published'
        })
            .select('title summary views_count helpful_count category_id')
            .populate('category_id', 'name priority color')
            .sort({ views_count: -1 })
            .limit(3)
            .lean();

        logger.info(`Agent viewed knowledge base article: ${article_id} by agent ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            data: {
                article: {
                    ...article,
                    views_count: article.views_count + 1 // Show updated count
                },
                related_articles: relatedArticles,
                popular_articles: popularArticles
            }
        });

    } catch (error) {
        logger.error(`Error retrieving agent knowledge base article: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve knowledge base article'
        });
    }
};

module.exports = getArticle;