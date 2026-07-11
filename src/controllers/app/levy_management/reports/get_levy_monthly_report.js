const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const mongoose = require('mongoose');

/**
 * Get Monthly Summary for Levy Contracts
 * Shows current month invoices, payments, and predicts next month's invoices
 */
const getLevyContractMonthlySummary = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            contractId,      // Filter by specific contract
            levyTypeId,      // Filter by levy type
            unitId,          // Filter by unit
            customerId,      // Filter by customer/tenant
            customerName,    // Filter by customer name (search)
            month,           // Format: "2025-12" (defaults to current month)
            limit = 100,     // Pagination limit
            offset = 0       // Pagination offset
        } = request.query;

        // Validate facilityId
        if (!mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid Facility ID format'
            });
        }

        // Get models
        const contractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const levyTypeModel = await getModel('LevyType', payservedb.LevyType.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const cashPaymentModel = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);

        // Determine current and next month
        const targetDate = month ? new Date(`${month}-01`) : new Date();
        const currentYear = targetDate.getFullYear();
        const currentMonth = targetDate.getMonth() + 1;
        const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        // Calculate next billing period based on frequency
        const getNextBillingPeriod = (frequency, currentYM) => {
            const [year, month] = currentYM.split('-').map(Number);
            let nextYear = year;
            let nextMonth = month;

            const freq = frequency?.toLowerCase() || 'monthly';
            
            switch (freq) {
                case 'quarterly':
                    nextMonth += 3;
                    break;
                case 'semi-annually':
                    nextMonth += 6;
                    break;
                case 'annually':
                    nextYear += 1;
                    nextMonth = month; // Same month next year
                    break;
                case 'bi-weekly':
                case 'weekly':
                case 'daily':
                case 'monthly':
                default:
                    nextMonth += 1;
                    break;
            }

            while (nextMonth > 12) {
                nextMonth -= 12;
                nextYear += 1;
            }

            return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        };

        // Build contract filter
        const contractFilter = { 
            facilityId: new mongoose.Types.ObjectId(facilityId),
            status: { $in: ['Active', 'Suspended'] }
        };

        // Apply filters (max 3 for performance)
        let filterCount = 0;
        if (contractId && mongoose.Types.ObjectId.isValid(contractId)) {
            contractFilter._id = new mongoose.Types.ObjectId(contractId);
            filterCount++;
        }
        if (unitId && mongoose.Types.ObjectId.isValid(unitId) && filterCount < 3) {
            contractFilter.unitId = new mongoose.Types.ObjectId(unitId);
            filterCount++;
        }
        if (customerId && mongoose.Types.ObjectId.isValid(customerId) && filterCount < 3) {
            contractFilter.customerId = new mongoose.Types.ObjectId(customerId);
            filterCount++;
        }

        // Fetch contracts with pagination
        const contracts = await contractModel.find(contractFilter)
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean();

        if (!contracts || contracts.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No active contracts found',
                data: {
                    summary: [],
                    currentMonth: currentYearMonth,
                    nextMonth: null,
                    totalContracts: 0,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: false
                    }
                }
            });
        }

        // Get total count for pagination
        const totalContracts = await contractModel.countDocuments(contractFilter);

        // Extract IDs for batch queries
        const contractIds = contracts.map(c => c._id);
        const levyIds = contracts.map(c => c.levyId);
        const unitIds = contracts.map(c => c.unitId);
        const customerIds = contracts.map(c => c.customerId);

        // Batch fetch related data
        const [levies, levyTypes, units, customers, currentInvoices, payments] = await Promise.all([
            levyModel.find({ _id: { $in: levyIds } }).lean(),
            levyTypeModel.find({ facilityId }).lean(),
            unitModel.find({ _id: { $in: unitIds } }).lean(),
            payservedb.Customer.find({ _id: { $in: customerIds } }).lean(),
            invoiceModel.find({
                'facility.id': new mongoose.Types.ObjectId(facilityId),
                'whatFor.invoiceType': 'Contract',
                yearMonth: currentYearMonth
            }).lean(),
            cashPaymentModel.find({
                'facility.id': new mongoose.Types.ObjectId(facilityId),
                approvalStatus: 'Approved',
                isVoided: false
            }).lean()
        ]);

        // Create lookup maps
        const levyMap = levies.reduce((map, levy) => {
            map[levy._id.toString()] = levy;
            return map;
        }, {});

        const levyTypeMap = levyTypes.reduce((map, type) => {
            map[type._id.toString()] = type;
            return map;
        }, {});

        const unitMap = units.reduce((map, unit) => {
            map[unit._id.toString()] = unit;
            return map;
        }, {});

        const customerMap = customers.reduce((map, customer) => {
            map[customer._id.toString()] = customer;
            return map;
        }, {});

        // Create invoice map by contract
        const invoicesByContract = {};
        currentInvoices.forEach(invoice => {
            const contractIdFromInvoice = invoice.whatFor?.description;
            if (contractIdFromInvoice) {
                if (!invoicesByContract[contractIdFromInvoice]) {
                    invoicesByContract[contractIdFromInvoice] = [];
                }
                invoicesByContract[contractIdFromInvoice].push(invoice);
            }
        });

        // Create payment map by invoice
        const paymentsByInvoice = {};
        payments.forEach(payment => {
            const invoiceId = payment.invoice?.invoiceId?.toString();
            if (invoiceId) {
                if (!paymentsByInvoice[invoiceId]) {
                    paymentsByInvoice[invoiceId] = [];
                }
                paymentsByInvoice[invoiceId].push(payment);
            }
        });

        // Helper to calculate frequency multiplier
        const getFrequencyMultiplier = (frequency) => {
            const freq = frequency?.toLowerCase() || 'monthly';
            switch (freq) {
                case 'quarterly': return 3;
                case 'semi-annually': return 6;
                case 'annually': return 12;
                default: return 1;
            }
        };

        // Process each contract
        const summary = await Promise.all(contracts.map(async (contract) => {
            const levy = levyMap[contract.levyId?.toString()];
            const unit = unitMap[contract.unitId?.toString()];
            const customer = customerMap[contract.customerId?.toString()];
            const levyType = levy ? levyTypeMap[levy.levyType?.toString()] : null;

            // Apply customer name filter if provided
            if (customerName && customer) {
                const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
                if (!fullName.includes(customerName.toLowerCase())) {
                    return null;
                }
            }

            // Get current month invoices for this contract
            const contractInvoices = invoicesByContract[contract._id.toString()] || [];

            // Calculate current month totals
            let currentMonthTotal = 0;
            let currentMonthPaid = 0;
            let currentMonthBalance = 0;
            let currentMonthPenalties = 0;
            const invoiceDetails = [];

            contractInvoices.forEach(invoice => {
                const invoicePayments = paymentsByInvoice[invoice._id.toString()] || [];
                const totalPaid = invoicePayments.reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
                
                // Balance = totalAmount + penalty + BBF - amountPaid
                const invoiceTotal = (invoice.totalAmount || 0);
                const invoicePenalty = (invoice.penalty || 0);
                const invoiceBBF = (invoice.balanceBroughtForward || 0);
                const balance = invoiceTotal + invoicePenalty + (invoiceBBF > 0 ? invoiceBBF : 0) - totalPaid;

                currentMonthTotal += invoiceTotal;
                currentMonthPaid += totalPaid;
                currentMonthBalance += balance;
                currentMonthPenalties += invoicePenalty;

                invoiceDetails.push({
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: invoiceTotal,
                    amountPaid: totalPaid,
                    balance: balance,
                    status: invoice.status,
                    issueDate: invoice.issueDate,
                    dueDate: invoice.dueDate,
                    penalty: invoicePenalty,
                    balanceBroughtForward: invoice.balanceBroughtForward || 0
                });
            });

            // Determine payment frequency
            const frequency = levy?.collectionFrequency || contract.paymentFrequency || 'Monthly';
            const nextBillingPeriod = getNextBillingPeriod(frequency, currentYearMonth);

            // Predict next month invoice
            const shouldGenerateNextMonth = contract.status === 'Active' && 
                                           (!contract.lastInvoiceYearMonth || 
                                            contract.lastInvoiceYearMonth < currentYearMonth);

            let nextMonthPrediction = null;
            if (shouldGenerateNextMonth && levy) {
                // Base amount for next billing period
                const baseAmount = contract.amount || levy.amount || 0;
                const frequencyMultiplier = getFrequencyMultiplier(frequency);
                const nextPeriodCharge = baseAmount * frequencyMultiplier;

                // Calculate tax (already included in totalAmount, but we need it for the breakdown)
                const taxRate = levy.taxRate || 0;
                const taxAmount = contract.taxEnabled && levy.taxEnabled 
                    ? (nextPeriodCharge * taxRate) / 100 
                    : 0;
                
                const nextPeriodTotal = nextPeriodCharge + taxAmount;

                // Add current unpaid balance (if any)
                const unpaidBalance = currentMonthBalance > 0 ? currentMonthBalance : 0;
                
                // Check if there's a credit (negative BBF or negative balance)
                const creditAmount = currentMonthBalance < 0 ? Math.abs(currentMonthBalance) : 0;
                
                // Calculate expected amount
                let expectedAmount = nextPeriodTotal + unpaidBalance - creditAmount;
                
                // If credit exceeds next period charge
                let willBeAutoPaid = false;
                let remainingCredit = 0;
                if (creditAmount > 0) {
                    if (creditAmount >= nextPeriodTotal) {
                        expectedAmount = 0;
                        remainingCredit = creditAmount - nextPeriodTotal;
                        willBeAutoPaid = true;
                    } else {
                        expectedAmount = nextPeriodTotal - creditAmount;
                    }
                }

                nextMonthPrediction = {
                    expectedAmount: Math.max(0, expectedAmount),
                    baseAmount: nextPeriodCharge,
                    taxAmount: taxAmount,
                    nextPeriodTotal: nextPeriodTotal,
                    unpaidBalance: unpaidBalance,
                    creditAmount: creditAmount,
                    remainingCredit: remainingCredit,
                    willBeAutoPaid: willBeAutoPaid,
                    dueDay: levy.invoiceDay || '1',
                    frequency: frequency,
                    frequencyMultiplier: frequencyMultiplier,
                    nextBillingPeriod: nextBillingPeriod,
                    willGenerate: true,
                    reason: willBeAutoPaid 
                        ? `Credit of ${creditAmount.toFixed(2)} will cover invoice, ${remainingCredit.toFixed(2)} remaining`
                        : unpaidBalance > 0 
                        ? `Contract is active, includes unpaid balance of ${unpaidBalance.toFixed(2)}`
                        : 'Contract is active and due for next invoice'
                };
            } else {
                nextMonthPrediction = {
                    willGenerate: false,
                    nextBillingPeriod: nextBillingPeriod,
                    reason: contract.status !== 'Active' 
                        ? 'Contract is not active' 
                        : 'Invoice already generated for current period'
                };
            }

            return {
                contractId: contract._id,
                contractName: contract.contractName,
                status: contract.status,
                
                // Customer info
                customer: customer ? {
                    customerId: customer._id,
                    fullName: `${customer.firstName} ${customer.lastName}`,
                    email: customer.email,
                    phoneNumber: customer.phoneNumber,
                    customerType: customer.customerType
                } : null,

                // Unit info
                unit: unit ? {
                    unitId: unit._id,
                    unitName: unit.name,
                    unitNumber: unit.unitNumber,
                    division: unit.division,
                    floor: unit.floor
                } : null,

                // Levy info
                levy: levy ? {
                    levyId: levy._id,
                    levyName: levy.levyName,
                    levyType: levyType?.name || 'Unknown',
                    amount: levy.amount,
                    frequency: levy.collectionFrequency,
                    taxEnabled: levy.taxEnabled,
                    taxRate: levy.taxRate
                } : null,

                // Current month summary
                currentMonth: {
                    yearMonth: currentYearMonth,
                    totalInvoiced: currentMonthTotal,
                    totalPaid: currentMonthPaid,
                    totalBalance: currentMonthBalance,
                    totalPenalties: currentMonthPenalties,
                    invoiceCount: contractInvoices.length,
                    paymentStatus: currentMonthBalance <= 0 ? 'Fully Paid' : 
                                  currentMonthPaid > 0 ? 'Partially Paid' : 'Unpaid',
                    invoices: invoiceDetails
                },

                // Next month prediction
                nextMonth: nextMonthPrediction,

                // Contract financial details
                contractAmount: contract.amount,
                paymentFrequency: contract.paymentFrequency,
                balanceBroughtForward: contract.balanceBroughtForward || 0,
                taxEnabled: contract.taxEnabled,
                startDate: contract.startDate,
                endDate: contract.endDate
            };
        }));

        // Filter out nulls
        const filteredSummary = summary.filter(item => item !== null);

        // Calculate overall statistics
        const statistics = {
            totalContracts: filteredSummary.length,
            currentMonth: {
                totalInvoiced: filteredSummary.reduce((sum, item) => sum + item.currentMonth.totalInvoiced, 0),
                totalPaid: filteredSummary.reduce((sum, item) => sum + item.currentMonth.totalPaid, 0),
                totalBalance: filteredSummary.reduce((sum, item) => sum + item.currentMonth.totalBalance, 0),
                totalPenalties: filteredSummary.reduce((sum, item) => sum + item.currentMonth.totalPenalties, 0),
                fullyPaid: filteredSummary.filter(item => item.currentMonth.paymentStatus === 'Fully Paid').length,
                partiallyPaid: filteredSummary.filter(item => item.currentMonth.paymentStatus === 'Partially Paid').length,
                unpaid: filteredSummary.filter(item => item.currentMonth.paymentStatus === 'Unpaid').length
            },
            nextMonth: {
                expectedToGenerate: filteredSummary.filter(item => item.nextMonth?.willGenerate).length,
                estimatedTotal: filteredSummary
                    .filter(item => item.nextMonth?.willGenerate)
                    .reduce((sum, item) => sum + (item.nextMonth?.expectedAmount || 0), 0),
                willBeAutoPaid: filteredSummary.filter(item => item.nextMonth?.willBeAutoPaid).length
            }
        };

        return reply.code(200).send({
            success: true,
            message: 'Levy contract monthly summary retrieved successfully',
            data: {
                currentMonth: currentYearMonth,
                nextMonth: filteredSummary.length > 0 && filteredSummary[0].nextMonth 
                    ? filteredSummary[0].nextMonth.nextBillingPeriod 
                    : null,
                statistics,
                contracts: filteredSummary,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalContracts,
                    hasMore: (parseInt(offset) + filteredSummary.length) < totalContracts
                }
            }
        });

    } catch (err) {
        console.error('Error in getLevyContractMonthlySummary:', err);
        return reply.code(500).send({
            success: false,
            error: err.message,
            message: 'Failed to retrieve levy contract monthly summary'
        });
    }
};

module.exports = getLevyContractMonthlySummary;