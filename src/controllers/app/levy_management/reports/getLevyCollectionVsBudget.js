const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getLevyCollectionVsBudget = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            search, 
            levyType = 'All Types', 
            period = 'Current Month',
            performanceFilter = 'All',
            page = 1, 
            limit = 10 
        } = request.query;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required.'
            });
        }

        // Get facility-specific models
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const levyTypeModel = payservedb.LevyType;

        // Helper function to generate yearMonth string
        const getYearMonth = (date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        // Helper function to get array of yearMonth values in a range
        const getYearMonthsInRange = (startDate, endDate) => {
            const months = [];
            const current = new Date(startDate);
            
            while (current <= endDate) {
                months.push(getYearMonth(current));
                current.setMonth(current.getMonth() + 1);
            }
            
            return months;
        };

        // Calculate date range based on period
        const today = new Date();
        let startDate, endDate, yearMonths;

        switch (period) {
            case 'Last Month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            case 'Quarter':
                const quarterStart = Math.floor(today.getMonth() / 3) * 3;
                startDate = new Date(today.getFullYear(), quarterStart, 1);
                endDate = new Date(today.getFullYear(), quarterStart + 3, 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            case 'Year to Date':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            default: // Current Month
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                yearMonths = [getYearMonth(today)];
        }

        // Build levy filter
        let levyFilter = {
            facilityId,
            disabled: false
        };

        // Add search filter
        if (search) {
            levyFilter.levyName = { $regex: new RegExp(search, 'i') };
        }

        // Get all active levies with populated levy type
        const levies = await levyModel.find(levyFilter)
            .populate({
                path: 'levyType',
                model: levyTypeModel,
                select: 'name'
            })
            .lean();

        // Filter by levy type if specified
        let filteredLevies = levies;
        if (levyType !== 'All Types') {
            filteredLevies = levies.filter(levy => levy.levyType?.name === levyType);
        }

        // Process each levy
        const levyReports = [];

        for (const levy of filteredLevies) {
            // Get all active contracts for this levy
            const contracts = await levyContractModel.find({
                levyId: levy._id,
                facilityId,
                status: 'Active'
            }).lean();

            // Calculate budget (expected revenue)
            const budgetAmount = contracts.reduce((sum, contract) => sum + (contract.amount || 0), 0) * yearMonths.length;

            // Get invoices for this levy in the period
            const levyInvoices = await invoiceModel.find({
                'facility.id': facilityId,
                'whatFor.invoiceType': levy.levyName,
                yearMonth: { $in: yearMonths },
                status: { $in: ['Paid', 'Partially Paid'] }
            }).select('amountPaid totalAmount').lean();

            // Calculate total collected
            const collectedAmount = levyInvoices.reduce((sum, invoice) => {
                return sum + (invoice.amountPaid || 0);
            }, 0);

            // Calculate variance
            const variance = collectedAmount - budgetAmount;
            const variancePercent = budgetAmount > 0 ? Math.round((variance / budgetAmount) * 100) : 0;
            const collectionRate = budgetAmount > 0 ? Math.round((collectedAmount / budgetAmount) * 100) : 0;

            // Count paid contracts (contracts with at least one paid invoice)
            const paidContractIds = new Set(
                levyInvoices.map(invoice => invoice.client?.clientId?.toString()).filter(Boolean)
            );
            const paidContracts = contracts.filter(contract => 
                paidContractIds.has(contract.customerId?.toString())
            ).length;

            const reportItem = {
                levyId: levy._id,
                levyName: levy.levyName,
                levyType: levy.levyType?.name || 'N/A',
                budgetAmount: Math.round(budgetAmount),
                collectedAmount: Math.round(collectedAmount),
                variance: Math.round(variance),
                variancePercent,
                collectionRate,
                totalContracts: contracts.length,
                paidContracts
            };

            levyReports.push(reportItem);
        }

        // Apply performance filter
        let filteredReports = levyReports;
        if (performanceFilter === 'On Track') {
            filteredReports = levyReports.filter(report => report.collectionRate >= 80);
        } else if (performanceFilter === 'Underperforming') {
            filteredReports = levyReports.filter(report => report.collectionRate < 80);
        }

        // Sort by collection rate (lowest first to highlight issues)
        filteredReports.sort((a, b) => a.collectionRate - b.collectionRate);

        // Calculate summary statistics
        const totalBudget = filteredReports.reduce((sum, report) => sum + report.budgetAmount, 0);
        const totalCollected = filteredReports.reduce((sum, report) => sum + report.collectedAmount, 0);
        const totalVariance = totalCollected - totalBudget;
        const avgCollectionRate = filteredReports.length > 0 
            ? Math.round(filteredReports.reduce((sum, report) => sum + report.collectionRate, 0) / filteredReports.length)
            : 0;
        const onTrackLevies = filteredReports.filter(report => report.collectionRate >= 80).length;
        const underperformingLevies = filteredReports.filter(report => report.collectionRate < 80).length;

        // Apply pagination
        const totalCount = filteredReports.length;
        const skip = (page - 1) * limit;
        const paginatedReports = filteredReports.slice(skip, skip + parseInt(limit));

        return reply.code(200).send({
            success: true,
            data: {
                levies: paginatedReports,
                summary: {
                    totalBudget: Math.round(totalBudget),
                    totalCollected: Math.round(totalCollected),
                    totalVariance: Math.round(totalVariance),
                    avgCollectionRate,
                    onTrackLevies,
                    underperformingLevies
                },
                period: {
                    selected: period,
                    startDate,
                    endDate,
                    yearMonths
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (err) {
        console.error('Error in getLevyCollectionVsBudget:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the levy collection vs budget report.'
        });
    }
};

module.exports = getLevyCollectionVsBudget;