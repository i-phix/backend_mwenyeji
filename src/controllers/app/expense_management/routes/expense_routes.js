const authenticateJWT = require('../../../../middlewares/jwt_authentication');

// Expense Categories Routes
const addExpenseCategory = require('../controllers/expense_category/add_expense_category');
const deleteExpenseCategory = require('../controllers/expense_category/delete_expense_category');
const getAllExpenseCategories = require('../controllers/expense_category/get_all_categories');

// Expense Routes
const addExpense = require('../controllers/expenses/add_expense');
const editExpense = require('../controllers/expenses/edit_expense');
const deleteExpense = require('../controllers/expenses/delete_expense');
const getAllExpenses = require('../controllers/expenses/get_all_expenses');
const getExpense = require('../controllers/expenses/get_expense');
const approveExpense = require('../controllers/expenses/approve_expenses');

// Budget Categories Routes
const addBudgetCategory = require('../controllers/budget_category/add_budget_category');
const editBudgetCategory = require('../controllers/budget_category/edit_budget_category');
const deleteBudgetCategory = require('../controllers/budget_category/delete_budget_category');
const getAllBudgetCategories = require('../controllers/budget_category/get_all_budget_categories');
const getBudgetCategory = require('../controllers/budget_category/get_budget_category');

// Budget Routes
const addBudget = require('../controllers/budget/add_budget');
const editBudget = require('../controllers/budget/edit_budget');
const deleteBudget = require('../controllers/budget/delete_budget');
const getAllBudgets = require('../controllers/budget/get_all_budgets');
const getBudget = require('../controllers/budget/get_budget');
const approveBudget = require('../controllers/budget/approve_budget');

async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };

    // Base Routes
    const expenseBaseRoute = '/api/app/expense_management/expenses';
    const budgetBaseRoute = '/api/app/expense_management';
    const budgetCategoryBaseRoute = '/api/app/budgetCategory';
    const expenseCategoryBaseRoute = '/api/app/expense_management/expense_category';

    // Expense Categories Routes
    fastify.post(`${expenseCategoryBaseRoute}/add_expense_category/:facilityId`, jwt, addExpenseCategory);
    fastify.get(`${expenseCategoryBaseRoute}/get_all_expense_categories/:facilityId`, jwt, getAllExpenseCategories);
    fastify.delete(`${expenseCategoryBaseRoute}/delete_expense_category/:facilityId/:categoryId`, jwt, deleteExpenseCategory);

    // Expense Routes
    fastify.post(`${expenseBaseRoute}/add_expense/:facilityId`, jwt, addExpense);
    fastify.put(`${expenseBaseRoute}/:facilityId/:expenseId`, jwt, editExpense);
    fastify.put(`${expenseBaseRoute}/approve/:facilityId/:expenseId`, jwt, approveExpense);
    fastify.delete(`${expenseBaseRoute}/:facilityId/:expenseId`, jwt, deleteExpense);
    fastify.get(`${expenseBaseRoute}/get_all/:facilityId`, jwt, getAllExpenses);
    fastify.get(`${expenseBaseRoute}/:facilityId/:expenseId`, jwt, getExpense);

    // Budget Categories Routes
    fastify.post(`${budgetCategoryBaseRoute}/:facilityId`, jwt, addBudgetCategory);
    fastify.put(`${budgetCategoryBaseRoute}/:facilityId/:budgetCategoryId`, jwt, editBudgetCategory);
    fastify.delete(`${budgetCategoryBaseRoute}/:facilityId/:budgetCategoryId`, jwt, deleteBudgetCategory);
    fastify.get(`${budgetCategoryBaseRoute}/:facilityId`, jwt, getAllBudgetCategories);
    fastify.get(`${budgetCategoryBaseRoute}/:facilityId/:budgetCategoryId`, jwt, getBudgetCategory);

    // Budget Routes
    fastify.post(`${budgetBaseRoute}/add_budget/:facilityId`, jwt, addBudget);
    fastify.put(`${budgetBaseRoute}/:facilityId/:budgetId`, jwt, editBudget);
    fastify.delete(`${budgetBaseRoute}/:facilityId/:budgetId`, jwt, deleteBudget);
    fastify.get(`${budgetBaseRoute}/get_budgets/:facilityId`, jwt, getAllBudgets);
    fastify.get(`${budgetBaseRoute}/:facilityId/:budgetId`, jwt, getBudget);
    fastify.put(`${budgetBaseRoute}/approve/:facilityId/:budgetId`, jwt, approveBudget);
}

module.exports = { registerRoutes };
