const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const mongoose = require('mongoose');

/**
 * Get Monthly Summary for Lease Agreements
 * Shows current month invoices, payments, and predicts next month's invoices
 */
const getLeaseAgreementMonthlySummary = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            leaseId,         // Filter by specific lease agreement
            unitId,          // Filter by unit
            tenantId,        // Filter by tenant (customer)
            tenantName,      // Filter by tenant name (search)
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
        const leaseModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const cashPaymentModel = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        const currencyModel = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Determine current month
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
                    nextMonth = month;
                    break;
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

        // Build lease filter
        const leaseFilter = { 
            facilityId: new mongoose.Types.ObjectId(facilityId),
            status: { $in: ['Active', 'Pending'] }
        };

        // Apply filters (max 3 for performance)
        let filterCount = 0;
        if (leaseId && mongoose.Types.ObjectId.isValid(leaseId)) {
            leaseFilter._id = new mongoose.Types.ObjectId(leaseId);
            filterCount++;
        }
        if (unitId && mongoose.Types.ObjectId.isValid(unitId) && filterCount < 3) {
            leaseFilter.unitNumber = new mongoose.Types.ObjectId(unitId);
            filterCount++;
        }
        if (tenantId && mongoose.Types.ObjectId.isValid(tenantId) && filterCount < 3) {
            leaseFilter.tenant = new mongoose.Types.ObjectId(tenantId);
            filterCount++;
        }

        // Fetch leases with pagination
        const leases = await leaseModel.find(leaseFilter)
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean();

        if (!leases || leases.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No active lease agreements found',
                data: {
                    summary: [],
                    currentMonth: currentYearMonth,
                    nextMonth: null,
                    totalLeases: 0,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: false
                    }
                }
            });
        }

        // Get total count for pagination
        const totalLeases = await leaseModel.countDocuments(leaseFilter);

        // Extract IDs for batch queries
        const leaseIds = leases.map(l => l._id);
        const unitIds = leases.map(l => l.unitNumber);
        const tenantIds = leases.map(l => l.tenant);
        const landlordIds = leases.map(l => l.landlord);
        const currencyIds = leases.map(l => l.currency);

        // Batch fetch related data
        const [units, tenants, landlords, currencies, currentInvoices, payments] = await Promise.all([
            unitModel.find({ _id: { $in: unitIds } }).lean(),
            payservedb.Customer.find({ _id: { $in: tenantIds } }).lean(),
            payservedb.Customer.find({ _id: { $in: landlordIds } }).lean(),
            currencyModel.find({ _id: { $in: currencyIds } }).lean(),
            invoiceModel.find({
                'facility.id': new mongoose.Types.ObjectId(facilityId),
                'whatFor.invoiceType': 'Lease',
                yearMonth: currentYearMonth
            }).lean(),
            cashPaymentModel.find({
                'facility.id': new mongoose.Types.ObjectId(facilityId),
                approvalStatus: 'Approved',
                isVoided: false
            }).lean()
        ]);

        // Create lookup maps
        const unitMap = units.reduce((map, unit) => {
            map[unit._id.toString()] = unit;
            return map;
        }, {});

        const tenantMap = tenants.reduce((map, tenant) => {
            map[tenant._id.toString()] = tenant;
            return map;
        }, {});

        const landlordMap = landlords.reduce((map, landlord) => {
            map[landlord._id.toString()] = landlord;
            return map;
        }, {});

        const currencyMap = currencies.reduce((map, currency) => {
            map[currency._id.toString()] = currency;
            return map;
        }, {});

        // Create invoice map by unit
        const invoicesByUnit = {};
        currentInvoices.forEach(invoice => {
            const unitId = invoice.unit?.id?.toString();
            if (unitId) {
                if (!invoicesByUnit[unitId]) {
                    invoicesByUnit[unitId] = [];
                }
                invoicesByUnit[unitId].push(invoice);
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

        // Helper function to calculate escalated rent
        const calculateCurrentRent = (lease) => {
            const baseRent = lease.financialTerms?.monthlyRent || 0;
            const escalations = lease.financialTerms?.escalations || [];
            
            const activeEscalations = escalations.filter(
                esc => esc.status === 'scheduled' && new Date(esc.effectiveDate) <= new Date()
            );

            if (activeEscalations.length === 0) return baseRent;

            const latestEscalation = activeEscalations.reduce((latest, current) =>
                new Date(current.effectiveDate) > new Date(latest.effectiveDate) ? current : latest
            );

            if (latestEscalation.type === 'percentage') {
                return baseRent * (1 + latestEscalation.value / 100);
            } else if (latestEscalation.type === 'fixed') {
                return baseRent + latestEscalation.value;
            }

            return baseRent;
        };

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

        // Process each lease
        const summary = await Promise.all(leases.map(async (lease) => {
            const unit = unitMap[lease.unitNumber?.toString()];
            const tenant = tenantMap[lease.tenant?.toString()];
            const landlord = landlordMap[lease.landlord?.toString()];
            const currency = currencyMap[lease.currency?.toString()];

            // Apply tenant name filter if provided
            if (tenantName && tenant) {
                const fullName = `${tenant.firstName} ${tenant.lastName}`.toLowerCase();
                if (!fullName.includes(tenantName.toLowerCase())) {
                    return null;
                }
            }

            // Get current month invoices for this lease
            const leaseInvoices = invoicesByUnit[lease.unitNumber?.toString()] || [];

            // Calculate current month totals
            let currentMonthTotal = 0;
            let currentMonthPaid = 0;
            let currentMonthBalance = 0;
            let currentMonthPenalties = 0;
            const invoiceDetails = [];

            leaseInvoices.forEach(invoice => {
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

            // Calculate current rent (with escalations)
            const currentRent = calculateCurrentRent(lease);
            const baseRent = lease.financialTerms?.monthlyRent || 0;
            const hasActiveEscalation = currentRent !== baseRent;

            // Determine billing frequency
            const frequency = lease.billingCycle?.frequency || 'Monthly';
            const frequencyMultiplier = getFrequencyMultiplier(frequency);
            const nextBillingPeriod = getNextBillingPeriod(frequency, currentYearMonth);

            // Calculate next billing period date for lease expiry check
            const [nextYear, nextMonth] = nextBillingPeriod.split('-').map(Number);
            const nextBillingDate = new Date(nextYear, nextMonth - 1, 1);

            // Predict next month invoice
            const shouldGenerateNextMonth = lease.status === 'Active' && 
                                           new Date(lease.leaseTerms?.endDate) > nextBillingDate &&
                                           (!lease.lastInvoiceYearMonth || 
                                            lease.lastInvoiceYearMonth < currentYearMonth);

            let nextMonthPrediction = null;
            if (shouldGenerateNextMonth) {
                // Calculate next period charge (with escalation and frequency)
                const nextPeriodCharge = currentRent * frequencyMultiplier;
                
                // Tax is already included in totalAmount, but we show it for breakdown
                // Assuming 16% VAT if tax is enabled
                const taxRate = lease.financialTerms?.taxEnabled ? 16 : 0;
                const taxAmount = (nextPeriodCharge * taxRate) / 100;
                const nextPeriodTotal = nextPeriodCharge + taxAmount;

                // Add current unpaid balance (if any)
                const unpaidBalance = currentMonthBalance > 0 ? currentMonthBalance : 0;
                
                // Check if there's a credit (negative balance)
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
                    baseRent: currentRent,
                    nextPeriodCharge: nextPeriodCharge,
                    taxAmount: taxAmount,
                    nextPeriodTotal: nextPeriodTotal,
                    unpaidBalance: unpaidBalance,
                    creditAmount: creditAmount,
                    remainingCredit: remainingCredit,
                    willBeAutoPaid: willBeAutoPaid,
                    dueDay: lease.financialTerms?.paymentDueDate || 1,
                    frequency: frequency,
                    frequencyMultiplier: frequencyMultiplier,
                    nextBillingPeriod: nextBillingPeriod,
                    hasEscalation: hasActiveEscalation,
                    willGenerate: true,
                    reason: willBeAutoPaid 
                        ? `Credit of ${creditAmount.toFixed(2)} will cover invoice, ${remainingCredit.toFixed(2)} remaining`
                        : unpaidBalance > 0 
                        ? `Lease is active, includes unpaid balance of ${unpaidBalance.toFixed(2)}`
                        : 'Lease is active and due for next invoice'
                };
            } else {
                nextMonthPrediction = {
                    willGenerate: false,
                    nextBillingPeriod: nextBillingPeriod,
                    reason: lease.status !== 'Active' 
                        ? 'Lease is not active' 
                        : new Date(lease.leaseTerms?.endDate) <= nextBillingDate
                        ? 'Lease will be expired'
                        : 'Invoice already generated for current period'
                };
            }

            return {
                leaseId: lease._id,
                status: lease.status,
                
                // Tenant info
                tenant: tenant ? {
                    tenantId: tenant._id,
                    fullName: `${tenant.firstName} ${tenant.lastName}`,
                    email: tenant.email,
                    phoneNumber: tenant.phoneNumber,
                    customerType: tenant.customerType
                } : null,

                // Landlord info
                landlord: landlord ? {
                    landlordId: landlord._id,
                    fullName: `${landlord.firstName} ${landlord.lastName}`,
                    email: landlord.email
                } : null,

                // Unit info
                unit: unit ? {
                    unitId: unit._id,
                    unitName: unit.name,
                    unitNumber: unit.unitNumber,
                    unitType: unit.unitType,
                    floor: unit.floor,
                    division: unit.division
                } : null,

                // Currency info
                currency: currency ? {
                    currencyId: currency._id,
                    name: currency.currencyName,
                    code: currency.currencyShortCode,
                    symbol: currency.currencySymbol
                } : null,

                // Current month summary
                currentMonth: {
                    yearMonth: currentYearMonth,
                    totalInvoiced: currentMonthTotal,
                    totalPaid: currentMonthPaid,
                    totalBalance: currentMonthBalance,
                    totalPenalties: currentMonthPenalties,
                    invoiceCount: leaseInvoices.length,
                    paymentStatus: currentMonthBalance <= 0 ? 'Fully Paid' : 
                                  currentMonthPaid > 0 ? 'Partially Paid' : 'Unpaid',
                    invoices: invoiceDetails
                },

                // Next month prediction
                nextMonth: nextMonthPrediction,

                // Lease financial details
                monthlyRent: baseRent,
                currentRent: currentRent,
                hasEscalation: hasActiveEscalation,
                securityDeposit: lease.financialTerms?.securityDeposit || 0,
                balanceBroughtForward: lease.financialTerms?.balanceBroughtForward || 0,
                taxEnabled: lease.financialTerms?.taxEnabled,
                billingFrequency: lease.billingCycle?.frequency,
                
                // Lease term info
                startDate: lease.leaseTerms?.startDate,
                endDate: lease.leaseTerms?.endDate,
                duration: lease.leaseTerms?.duration,
                autoRenewal: lease.leaseTerms?.autoRenewal,
                daysUntilExpiry: Math.ceil((new Date(lease.leaseTerms?.endDate) - new Date()) / (1000 * 60 * 60 * 24))
            };
        }));

        // Filter out nulls
        const filteredSummary = summary.filter(item => item !== null);

        // Calculate overall statistics
        const statistics = {
            totalLeases: filteredSummary.length,
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
            },
            leasesExpiringSoon: filteredSummary.filter(item => 
                item.daysUntilExpiry > 0 && item.daysUntilExpiry <= 30
            ).length
        };

        return reply.code(200).send({
            success: true,
            message: 'Lease agreement monthly summary retrieved successfully',
            data: {
                currentMonth: currentYearMonth,
                nextMonth: filteredSummary.length > 0 && filteredSummary[0].nextMonth 
                    ? filteredSummary[0].nextMonth.nextBillingPeriod 
                    : null,
                statistics,
                leases: filteredSummary,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalLeases,
                    hasMore: (parseInt(offset) + filteredSummary.length) < totalLeases
                }
            }
        });

    } catch (err) {
        console.error('Error in getLeaseAgreementMonthlySummary:', err);
        return reply.code(500).send({
            success: false,
            error: err.message,
            message: 'Failed to retrieve lease agreement monthly summary'
        });
    }
};

module.exports = getLeaseAgreementMonthlySummary;