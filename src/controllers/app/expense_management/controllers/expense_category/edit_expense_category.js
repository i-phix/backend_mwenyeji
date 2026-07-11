const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const updateExpenseCategory = async (request, reply) => {
    try {
        const { facilityId, categoryId } = request.params;
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

        // Check if category exists
        const existingCategory = await expenseCategoryModel.findOne({
            _id: categoryId,
            facilityId
        });

        if (!existingCategory) {
            return reply.code(404).send({
                error: 'Expense category not found'
            });
        }

        // Check if another category with the same name exists (excluding current category)
        const duplicateCategory = await expenseCategoryModel.findOne({
            facilityId,
            name: name.trim(),
            _id: { $ne: categoryId }
        }).lean();

        if (duplicateCategory) {
            return reply.code(400).send({
                error: 'Another expense category with this name already exists for this facility'
            });
        }

        // Prepare the update data
        const updateData = {
            name: name.trim()
        };

        // Add GL accounts if provided
        if (glAccounts) {
            updateData.glAccounts = glAccounts;
        }

        const updatedExpenseCategory = await expenseCategoryModel.findByIdAndUpdate(
            categoryId,
            updateData,
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            success: true,
            message: 'Expense category updated successfully',
            data: updatedExpenseCategory
        });
    } catch (err) {
        console.error('Error updating expense category:', err);
        return reply.code(400).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = updateExpenseCategory;