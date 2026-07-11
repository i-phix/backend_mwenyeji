const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteBudget = async (request, reply) => {
    try {
        const { facilityId, budgetId } = request.params;

        const budgetModel = await getModel('Budget', payservedb.Budget.schema, facilityId);

        const deletedBudget = await budgetModel.findByIdAndDelete(budgetId);

        if (!deletedBudget) {
            return reply.code(404).send({ error: 'Budget not found' });
        }

        return reply.code(200).send({
            message: 'Budget deleted successfully',
            budget: deletedBudget
        });
    } catch (err) {
        
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = deleteBudget;