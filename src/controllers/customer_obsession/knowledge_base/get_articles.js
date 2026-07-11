const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function get_articles(request, reply) {
    try {
        const agent = request.user;

        // Extract query parameters
        const {
            search,
            category,
            tags,
            status = 'published',
            visibility,
            page = 1,
            limit = 50
        } = request.query;

        // Build filter query
        let filter = {};

        // Only show published articles for agents
        filter.status = status;

        // Filter by visibility if specified (agents see all if not specified)
        if (visibility) {
            filter.visibility = visibility;
        }

        // Category filter
        if (category) {
            filter.category = category;
        }

        // Tags filter
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            filter.tags = { $in: tagArray };
        }

        // Search filter
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { content_summary: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        console.log('Knowledge base filter:', filter);

        // Get articles
        const articles = await payservedb.KnowledgeBase.find(filter)
            .populate('created_by', 'fullName firstName lastName email')
            .populate('updated_by', 'fullName firstName lastName email')
            .populate('category_id', 'name priority color')
            .sort({ view_count: -1, helpful_count: -1, created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        console.log(`Found ${articles.length} knowledge base articles`);

        // Get total count
        const total_count = await payservedb.KnowledgeBase.countDocuments(filter);

        // Pagination metadata
        const pagination = {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_items: total_count,
            total_pages: Math.ceil(total_count / parseInt(limit)),
            has_next_page: parseInt(page) < Math.ceil(total_count / parseInt(limit)),
            has_prev_page: parseInt(page) > 1
        };

        logger.info(`Agent ${agent.agent?.agent_id || agent.userId} retrieved ${articles.length} KB articles`);

        return reply.code(200).send({
            success: true,
            data: articles,
            pagination
        });

    } catch (error) {
        console.error('Error fetching knowledge base articles:', error);
        logger.error(`Error fetching knowledge base articles: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve knowledge base articles'
        });
    }
}

module.exports = get_articles;
