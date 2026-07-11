const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getAllBudgetCategories = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { title } = request.query;

        const budgetCategoryModel = await getModel('BudgetCategory', payservedb.BudgetCategory.schema, facilityId);

        const query = { facilityId };
        
        if (title) query.title = { $regex: title, $options: 'i' };

        const budgetCategories = await budgetCategoryModel.find(query);

        return reply.code(200).send({
            message: 'Budget Categories retrieved successfully',
            budgetCategories
        });
    } catch (err) {
       
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getAllBudgetCategories;