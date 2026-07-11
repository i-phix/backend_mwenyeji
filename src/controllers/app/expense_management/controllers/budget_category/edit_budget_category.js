const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const editBudgetCategory = async (request, reply) => {
    try {
        const { facilityId, budgetCategoryId } = request.params;
        const { title } = request.body;

        const budgetCategoryModel = await getModel('BudgetCategory', payservedb.BudgetCategory.schema, facilityId);

        const updatedBudgetCategory = await budgetCategoryModel.findByIdAndUpdate(
            budgetCategoryId,
            { title },
            { new: true, runValidators: true }
        );

        if (!updatedBudgetCategory) {
            return reply.code(404).send({ error: 'Budget Category not found' });
        }

        return reply.code(200).send({
            message: 'Budget Category updated successfully',
            budgetCategory: updatedBudgetCategory
        });
    } catch (err) {
      
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = editBudgetCategory;