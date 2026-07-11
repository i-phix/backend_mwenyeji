const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteExpense = async (request, reply) => {
    try {
        const { facilityId, expenseId } = request.params;

        const expenseModel = await getModel('Expense', payservedb.Expense.schema, facilityId);

        const deletedExpense = await expenseModel.findByIdAndDelete(expenseId);

        if (!deletedExpense) {
            return reply.code(404).send({ error: 'Expense not found' });
        }

        return reply.code(200).send({
            message: 'Expense deleted successfully',
            expense: deletedExpense
        });
    } catch (err) {
       
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = deleteExpense;