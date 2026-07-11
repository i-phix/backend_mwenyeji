const db = require('payservedb');
const logger = require('../../../../config/winston');

const searchArticles = async (request, reply) => {
    try {
        const { query, category, limit = 10 } = request.query;

        if (!query) {
            return reply.code(400).send({
                success: false,
                error: 'Search query is required'
            });
        }

        // Build search filter
        const filter = {
            status: 'published',
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { content: { $regex: query, $options: 'i' } },
                { summary: { $regex: query, $options: 'i' } },
                { tags: { $in: [new RegExp(query, 'i')] } }
            ]
        };

        if (category) {
            filter.category = category;
        }

        // Search articles with relevance scoring
        const articles = await db.KnowledgeBase.find(filter)
            .select('title summary category tags helpful_count views_count created_at')
            .populate('author_id', 'fullName')
            .sort({ helpful_count: -1, views_count: -1 })
            .limit(parseInt(limit))
            .lean();

        // Add search relevance scoring
        const scoredArticles = articles.map(article => {
            let score = 0;
            const lowerQuery = query.toLowerCase();
            const lowerTitle = article.title.toLowerCase();
            const lowerSummary = (article.summary || '').toLowerCase();

            // Title matches get higher score
            if (lowerTitle.includes(lowerQuery)) score += 10;
            if (lowerTitle.startsWith(lowerQuery)) score += 5;

            // Summary matches
            if (lowerSummary.includes(lowerQuery)) score += 5;

            // Tag matches
            const tagMatches = article.tags.filter(tag =>
                tag.toLowerCase().includes(lowerQuery)
            ).length;
            score += tagMatches * 3;

            // Boost popular articles
            score += Math.log(article.helpful_count + 1);
            score += Math.log(article.views_count + 1) * 0.1;

            return {
                ...article,
                relevance_score: score
            };
        });

        // Sort by relevance score
        scoredArticles.sort((a, b) => b.relevance_score - a.relevance_score);

        // Get search suggestions (categories that match)
        const suggestions = await db.KnowledgeBase.distinct('category', {
            status: 'published',
            category: { $regex: query, $options: 'i' }
        });

        logger.info(`Agent searched knowledge base: "${query}" - ${articles.length} results for agent ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            data: {
                query,
                articles: scoredArticles,
                total_results: articles.length,
                suggestions,
                category_filter: category
            }
        });

    } catch (error) {
        logger.error(`Error searching knowledge base: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to search knowledge base'
        });
    }
};

module.exports = searchArticles;