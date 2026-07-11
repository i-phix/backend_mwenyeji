const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getBudgetCategoryById = async (request, reply) => {
    try {
        const { facilityId, budgetCategoryId } = request.params;

        const budgetCategoryModel = await getModel('BudgetCategory', payservedb.BudgetCategory.schema, facilityId);

        const budgetCategory = await budgetCategoryModel.findById(budgetCategoryId);

        if (!budgetCategory) {
            return reply.code(404).send({ error: 'Budget Category not found' });
        }

        return reply.code(200).send({
            message: 'Budget Category retrieved successfully',
            budgetCategory
        });
    } catch (err) {
       
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getBudgetCategoryById;