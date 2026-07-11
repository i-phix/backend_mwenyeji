const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getBudgetById = async (request, reply) => {
    try {
        const { facilityId, budgetId } = request.params;

        const budgetModel = await getModel('Budget', payservedb.Budget.schema, facilityId);

        const budget = await budgetModel
            .findById(budgetId)
            .populate('categoryId', 'title');

        if (!budget) {
            return reply.code(404).send({ error: 'Budget not found' });
        }

        return reply.code(200).send({
            message: 'Budget retrieved successfully',
            budget
        });
    } catch (err) {
       
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getBudgetById;