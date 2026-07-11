const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const editBudget = async (request, reply) => {
    try {
        const { facilityId, budgetId } = request.params;
        const { 
            categoryId, 
            amount, 
            period 
        } = request.body;

        const budgetModel = await getModel('Budget', payservedb.Budget.schema, facilityId);

        const updatedBudget = await budgetModel.findByIdAndUpdate(
            budgetId,
            { 
                categoryId, 
                amount, 
                period: {
                    startDate: period.startDate,
                    endDate: period.endDate
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedBudget) {
            return reply.code(404).send({ error: 'Budget not found' });
        }

        return reply.code(200).send({
            message: 'Budget updated successfully',
            budget: updatedBudget
        });
    } catch (err) {
       
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = editBudget;