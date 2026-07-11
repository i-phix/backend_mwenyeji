const db = require('payservedb');
const logger = require('../../../../../config/winston');

const getArticles = async (request, reply) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            status,
            search,
            author_id,
            is_featured,
            sort_by = 'created_at',
            sort_order = 'desc'
        } = request.query;

        // Build filter object
        const filter = {};

        if (category) filter.category_id = category;
        if (status) {
            filter.status = status;
        } else {
            // By default, exclude archived articles
            filter.status = { $ne: 'archived' };
        }
        if (author_id) filter.author_id = author_id;
        if (is_featured !== undefined) filter.is_featured = is_featured === 'true';

        // Search functionality
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { summary: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = sort_order === 'desc' ? -1 : 1;

        // Get articles with pagination
        const articles = await db.KnowledgeBase.find(filter)
            .populate('author_id', 'fullName email')
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email')
            .populate('category_id', 'name priority color')
            .sort({ [sort_by]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Transform articles to include category field for frontend compatibility
        const transformedArticles = articles.map(article => ({
            ...article,
            category: article.category_id?.name || 'Uncategorized'
        }));

        // Get total count for pagination
        const totalArticles = await db.KnowledgeBase.countDocuments(filter);
        const totalPages = Math.ceil(totalArticles / parseInt(limit));

        // Get distinct categories
        const categoryIds = await db.KnowledgeBase.distinct('category_id', { status: { $ne: 'archived' } });
        const categories = await db.TicketCategory.find({ _id: { $in: categoryIds }, is_active: true })
            .select('name')
            .lean();

        const pagination = {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_items: totalArticles,
            total_pages: totalPages,
            has_next_page: parseInt(page) < totalPages,
            has_prev_page: parseInt(page) > 1
        };

        logger.info(`Knowledge base articles retrieved: ${articles.length} items`);

        return reply.code(200).send({
            success: true,
            data: {
                articles: transformedArticles,
                pagination,
                categories,
                filters: {
                    category,
                    status,
                    search,
                    author_id,
                    is_featured
                }
            }
        });

    } catch (error) {
        logger.error(`Error retrieving knowledge base articles: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve knowledge base articles'
        });
    }
};

module.exports = getArticles;