const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteBudgetCategory = async (request, reply) => {
    try {
        const { facilityId, budgetCategoryId } = request.params;

        const budgetCategoryModel = await getModel('BudgetCategory', payservedb.BudgetCategory.schema, facilityId);

        const deletedBudgetCategory = await budgetCategoryModel.findByIdAndDelete(budgetCategoryId);

        if (!deletedBudgetCategory) {
            return reply.code(404).send({ error: 'Budget Category not found' });
        }

        return reply.code(200).send({
            message: 'Budget Category deleted successfully',
            budgetCategory: deletedBudgetCategory
        });
    } catch (err) {
        
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = deleteBudgetCategory;