const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addBudgetCategory = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { title } = request.body;

        const budgetCategoryModel = await getModel('BudgetCategory', payservedb.BudgetCategory.schema, facilityId);

        const newBudgetCategory = await budgetCategoryModel.create({
            facilityId,
            title
        });

        return reply.code(200).send({
            message: 'Budget Category added successfully',
            budgetCategory: newBudgetCategory
        });
    } catch (err) {
       
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = addBudgetCategory;