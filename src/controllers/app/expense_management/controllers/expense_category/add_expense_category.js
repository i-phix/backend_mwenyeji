const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addExpenseCategory = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { name, glAccounts } = request.body;

        // Validate required fields
        if (!name) {
            return reply.code(400).send({
                error: 'Name is required',
            });
        }

        // Validate GL accounts if provided
        if (glAccounts) {
            const { invoice, payment } = glAccounts;
            
            // Check if all required GL account fields are provided
            if (!invoice || !payment) {
                return reply.code(400).send({
                    error: 'Both invoice and payment GL accounts are required'
                });
            }

            if (!invoice.debit || !invoice.credit || !payment.debit || !payment.credit) {
                return reply.code(400).send({
                    error: 'All GL account fields (invoice debit/credit, payment debit/credit) are required'
                });
            }

            // Validate that GL account IDs are valid ObjectIds
            const mongoose = require('mongoose');
            const glAccountIds = [
                invoice.debit,
                invoice.credit,
                payment.debit,
                payment.credit
            ];

            for (const id of glAccountIds) {
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    return reply.code(400).send({
                        error: `Invalid GL account ID: ${id}`
                    });
                }
            }
        }

        const expenseCategoryModel = await getModel('ExpenseCategory', payservedb.ExpenseCategory.schema, facilityId);

        // Check if category with same name already exists for this facility
        const existingCategory = await expenseCategoryModel.findOne({
            facilityId,
            name: name.trim()
        }).lean();

        if (existingCategory) {
            return reply.code(400).send({
                error: 'Expense category with this name already exists for this facility'
            });
        }

        // Prepare the category data
        const categoryData = {
            facilityId,
            name: name.trim()
        };

        // Add GL accounts if provided
        if (glAccounts) {
            categoryData.glAccounts = glAccounts;
        }

        const newExpenseCategory = await expenseCategoryModel.create(categoryData);

        return reply.code(200).send({
            success: true,
            message: 'Expense category added successfully',
            data: newExpenseCategory
        });
    } catch (err) {
        console.error('Error adding expense category:', err);
        return reply.code(400).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = addExpenseCategory;