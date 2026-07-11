const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_property_manager_revenue = async (request, reply) => {
    const { facilityId } = request.params;
    const { 
        startDate, 
        endDate, 
        unitId, 
        propertyManagerId, 
        page = 1, 
        limit = 10,
        includeDetails = false,
        sortBy = 'calculationDate',
        sortOrder = 'desc',
        calculationType
    } = request.query;

    try {
        console.log(`[Get Revenue] ========== STARTING REVENUE RETRIEVAL ==========`);
        console.log(`[Get Revenue] Facility: ${facilityId}`);
        console.log(`[Get Revenue] Parameters:`, {
            startDate, endDate, unitId, propertyManagerId, page, limit, 
            includeDetails, sortBy, sortOrder, calculationType
        });

        // Validate facilityId
        if (!facilityId) {
            console.log(`[Get Revenue] ERROR: No facility ID provided`);
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        console.log(`[Get Revenue] Step 1: Getting models for facility ${facilityId}`);
        // Dynamically fetch models with facility context
        const models = {
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            invoice: await getModel('Invoice', payservedb.Invoice.schema, facilityId),
            propertyManagerRevenue: await getModel('PropertyManagerRevenue', payservedb.PropertyManagerRevenue.schema, facilityId),
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId)
        };
        console.log(`[Get Revenue] Step 1: ✅ Models loaded successfully`);

        console.log(`[Get Revenue] Step 2: Building query for revenue records`);
        // Build query
        let query = { facility: facilityId };

        // Add date range filter
        if (startDate || endDate) {
            query.calculationDate = {};
            if (startDate) {
                query.calculationDate.$gte = new Date(startDate);
                console.log(`[Get Revenue] Step 2: Added start date filter: ${startDate}`);
            }
            if (endDate) {
                query.calculationDate.$lte = new Date(endDate);
                console.log(`[Get Revenue] Step 2: Added end date filter: ${endDate}`);
            }
        }

        // Add calculation type filter
        if (calculationType) {
            query.calculationType = calculationType;
            console.log(`[Get Revenue] Step 2: Added calculation type filter: ${calculationType}`);
        }

        // Add unit filter
        if (unitId) {
            query['unitBreakdown.unit'] = new mongoose.Types.ObjectId(unitId);
            console.log(`[Get Revenue] Step 2: Added unit filter: ${unitId}`);
        }

        console.log(`[Get Revenue] Step 3: Handling property manager filter`);
        // Add property manager filter
        if (propertyManagerId) {
            console.log(`[Get Revenue] Step 3: Getting contracts for property manager: ${propertyManagerId}`);
            
            // Get contracts for this property manager to find their units
            const managerContracts = await models.propertyManagerContract.find({
                facilityId: facilityId,
                propertyManager: new mongoose.Types.ObjectId(propertyManagerId),
                status: 'Active'
            }).select('units').lean();

            console.log(`[Get Revenue] Step 3: Found ${managerContracts.length} contracts for property manager`);

            if (managerContracts.length > 0) {
                const managerUnitIds = managerContracts.reduce((acc, contract) => {
                    return acc.concat(contract.units || []);
                }, []);

                console.log(`[Get Revenue] Step 3: Property manager manages ${managerUnitIds.length} units`);

                if (managerUnitIds.length > 0) {
                    query['unitBreakdown.unit'] = unitId ? 
                        { $in: [new mongoose.Types.ObjectId(unitId), ...managerUnitIds] } : 
                        { $in: managerUnitIds };
                } else {
                    console.log(`[Get Revenue] Step 3: ❌ No units found for this property manager`);
                    return reply.code(200).send({
                        success: true,
                        message: 'No revenue records found for the specified property manager',
                        data: [],
                        summary: await getCompleteSummaryData(facilityId, models, []),
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            totalRecords: 0,
                            totalPages: 0,
                            hasNext: false,
                            hasPrev: false
                        }
                    });
                }
            } else {
                console.log(`[Get Revenue] Step 3: ❌ No active contracts found for this property manager`);
                return reply.code(200).send({
                    success: true,
                    message: 'No active contracts found for the specified property manager',
                    data: [],
                    summary: await getCompleteSummaryData(facilityId, models, []),
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalRecords: 0,
                        totalPages: 0,
                        hasNext: false,
                        hasPrev: false
                    }
                });
            }
        }

        console.log(`[Get Revenue] Step 4: Final query:`, JSON.stringify(query, null, 2));

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
        console.log(`[Get Revenue] Step 4: Sort configuration:`, sortObj);

        console.log(`[Get Revenue] Step 5: Getting total count of revenue records`);
        // Get total count
        const totalRecords = await models.propertyManagerRevenue.countDocuments(query);
        console.log(`[Get Revenue] Step 5: Found ${totalRecords} total revenue records`);

        console.log(`[Get Revenue] Step 6: Fetching revenue records (page ${page}, limit ${limit})`);
        // Get revenue records
        const revenueRecords = await models.propertyManagerRevenue
            .find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        console.log(`[Get Revenue] Step 6: Retrieved ${revenueRecords.length} revenue records`);

        // Log sample records for debugging
        revenueRecords.slice(0, 2).forEach((record, index) => {
            console.log(`[Get Revenue] Step 6: Sample Record ${index + 1}:`, {
                id: record._id,
                calculationDate: record.calculationDate,
                totalRevenue: record.totalRevenue,
                totalPaidAmount: record.totalPaidAmount,
                unitsProcessed: record.unitsProcessed,
                invoicesProcessed: record.invoicesProcessed,
                unitBreakdownCount: record.unitBreakdown?.length || 0
            });
        });

        console.log(`[Get Revenue] Step 7: Calculating enhanced summary statistics`);
        // Calculate enhanced summary statistics
        const summaryStats = await models.propertyManagerRevenue.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalRevenue' },
                    totalOwnerAmount: { $sum: '$totalOwnerAmount' },
                    totalPaidAmount: { $sum: '$totalPaidAmount' },
                    totalInvoicesProcessed: { $sum: '$invoicesProcessed' },
                    totalUnitsProcessed: { $sum: '$unitsProcessed' },
                    totalContractsProcessed: { $sum: '$contractsProcessed' },
                    averageRevenue: { $avg: '$totalRevenue' },
                    recordCount: { $sum: 1 },
                    minCalculationDate: { $min: '$calculationDate' },
                    maxCalculationDate: { $max: '$calculationDate' }
                }
            }
        ]);

        // Get complete summary with contract/unit data
        const enhancedSummary = await getCompleteSummaryData(facilityId, models, summaryStats);

        console.log(`[Get Revenue] Step 7: Enhanced summary calculated:`, {
            totalRevenue: enhancedSummary.totalRevenue,
            activeContracts: enhancedSummary.activeContracts,
            managedUnits: enhancedSummary.managedUnits,
            unprocessedInvoices: enhancedSummary.unprocessedPMInvoices
        });

        console.log(`[Get Revenue] Step 8: Getting analytics data (includeDetails=${includeDetails})`);
        // Get additional analytics if requested
        let analytics = null;
        if (includeDetails === 'true') {
            console.log(`[Get Revenue] Step 8: Generating detailed analytics...`);
            analytics = await getRevenueAnalytics(facilityId, query, models);
            console.log(`[Get Revenue] Step 8: Analytics generated:`, {
                hasMonthlyRevenue: !!analytics?.monthlyRevenue,
                hasUnitTypeRevenue: !!analytics?.unitTypeRevenue,
                hasManagerRevenue: !!analytics?.managerRevenue,
                hasUnprocessedStats: !!analytics?.unprocessedInvoicesStats
            });
        }

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalRecords / parseInt(limit));
        const hasNext = parseInt(page) < totalPages;
        const hasPrev = parseInt(page) > 1;

        console.log(`[Get Revenue] Step 9: Preparing response data`);
        // Prepare response data based on detail level
        const responseData = includeDetails === 'true' ? revenueRecords : revenueRecords.map(record => ({
            _id: record._id,
            calculationDate: record.calculationDate,
            dateRange: record.dateRange,
            totalRevenue: record.totalRevenue,
            totalOwnerAmount: record.totalOwnerAmount,
            totalPaidAmount: record.totalPaidAmount,
            unitsProcessed: record.unitsProcessed,
            invoicesProcessed: record.invoicesProcessed,
            contractsProcessed: record.contractsProcessed,
            status: record.status,
            calculationType: record.calculationType,
            createdAt: record.createdAt,
            createdBy: record.createdBy,
            summary: record.summary
        }));

        console.log(`[Get Revenue] Step 9: Enhanced summary prepared with ${Object.keys(enhancedSummary).length} metrics`);

        console.log(`[Get Revenue] ========== RETRIEVAL COMPLETED SUCCESSFULLY ==========`);
        console.log(`[Get Revenue] Returning ${responseData.length} records`);

        return reply.code(200).send({
            success: true,
            message: 'Property manager revenue retrieved successfully',
            data: responseData,
            summary: enhancedSummary,
            analytics,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalRecords,
                totalPages,
                hasNext,
                hasPrev
            },
            filters: {
                startDate,
                endDate,
                unitId,
                propertyManagerId,
                calculationType,
                includeDetails,
                sortBy,
                sortOrder
            }
        });

    } catch (error) {
        console.error('[Get Revenue] ❌ CRITICAL ERROR:', error);
        console.error('[Get Revenue] Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            message: 'Failed to retrieve property manager revenue',
            error: error.message
        });
    }
};

/**
 * Get complete summary data including contract/unit information - ENHANCED
 */
const getCompleteSummaryData = async (facilityId, models, summaryStats) => {
    try {
        console.log(`[Complete Summary] Building enhanced summary for facility: ${facilityId}`);
        
        // Get base summary from revenue records
        const baseSummary = summaryStats[0] || {
            totalRevenue: 0,
            totalOwnerAmount: 0,
            totalPaidAmount: 0,
            totalInvoicesProcessed: 0,
            totalUnitsProcessed: 0,
            totalContractsProcessed: 0,
            averageRevenue: 0,
            recordCount: 0,
            minCalculationDate: null,
            maxCalculationDate: null
        };

        // Get active contracts information
        const activeContracts = await models.propertyManagerContract.find({
            facilityId: facilityId,
            status: 'Active'
        }).populate({
            path: 'propertyManager',
            model: payservedb.User,
            select: 'fullName email'
        }).lean();

        console.log(`[Complete Summary] Found ${activeContracts.length} active contracts`);

        // Get managed units
        const managedUnitIds = activeContracts.reduce((acc, contract) => {
            return acc.concat(contract.units || []);
        }, []);

        // Remove duplicates
        const uniqueManagedUnitIds = [...new Set(managedUnitIds.map(id => id.toString()))];

        console.log(`[Complete Summary] Found ${uniqueManagedUnitIds.length} unique managed units`);

        // Get actual unit details
        const managedUnits = await models.unit.find({
            _id: { $in: uniqueManagedUnitIds }
        }).lean();

        console.log(`[Complete Summary] Retrieved ${managedUnits.length} unit records`);

        // ENHANCED: Get all processed invoice numbers using aggregation
        const processedInvoiceNumbers = await models.propertyManagerRevenue.aggregate([
            {
                $match: {
                    facility: new mongoose.Types.ObjectId(facilityId)
                }
            },
            { $unwind: '$unitBreakdown' },
            { $unwind: '$unitBreakdown.invoices' },
            {
                $group: {
                    _id: null,
                    invoiceNumbers: { $addToSet: '$unitBreakdown.invoices.invoiceNumber' }
                }
            }
        ]);

        const alreadyProcessedNumbers = processedInvoiceNumbers.length > 0 
            ? processedInvoiceNumbers[0].invoiceNumbers.filter(Boolean)
            : [];

        console.log(`[Complete Summary] Found ${alreadyProcessedNumbers.length} processed invoice numbers`);

        // Get all paid Property-Management invoices
        const allPMInvoices = await models.invoice.find({
            'facility.id': new mongoose.Types.ObjectId(facilityId),
            'unit.id': { $in: uniqueManagedUnitIds.map(id => new mongoose.Types.ObjectId(id)) },
            status: 'Paid',
            amountPaid: { $gt: 0 },
            $or: [
                { 'whatFor.invoiceType': 'Property-Management' },
                { 'whatFor.invoiceType': 'PropertyManagement' },
                { 'whatFor.invoiceType': 'Property Management' }
            ]
        }).select('invoiceNumber propertyManagerRevenueCalculated amountPaid').lean();

        console.log(`[Complete Summary] Found ${allPMInvoices.length} total paid PM invoices`);

        // ENHANCED: Filter using both methods for maximum accuracy
        const processedInvoices = allPMInvoices.filter(invoice => {
            const isProcessedByFlag = invoice.propertyManagerRevenueCalculated === true;
            const isProcessedByNumber = alreadyProcessedNumbers.includes(invoice.invoiceNumber);
            return isProcessedByFlag || isProcessedByNumber;
        });

        const unprocessedInvoices = allPMInvoices.filter(invoice => {
            const isProcessedByFlag = invoice.propertyManagerRevenueCalculated === true;
            const isProcessedByNumber = alreadyProcessedNumbers.includes(invoice.invoiceNumber);
            return !isProcessedByFlag && !isProcessedByNumber;
        });

        const totalPaidAmount = allPMInvoices.reduce((sum, invoice) => sum + (invoice.amountPaid || 0), 0);

        console.log(`[Complete Summary] Enhanced processing stats:`, {
            processedInvoices: processedInvoices.length,
            unprocessedInvoices: unprocessedInvoices.length,
            totalPaidAmount: totalPaidAmount
        });

        // Build complete summary
        const completeSummary = {
            // Revenue data from existing records
            totalRevenue: baseSummary.totalRevenue || 0,
            totalOwnerAmount: baseSummary.totalOwnerAmount || 0,
            totalPaidAmount: baseSummary.totalPaidAmount || 0,
            totalInvoicesProcessed: baseSummary.totalInvoicesProcessed || 0,
            totalUnitsProcessed: baseSummary.totalUnitsProcessed || 0,
            totalContractsProcessed: baseSummary.totalContractsProcessed || 0,
            averageRevenue: baseSummary.averageRevenue || 0,
            recordCount: baseSummary.recordCount || 0,
            minCalculationDate: baseSummary.minCalculationDate,
            maxCalculationDate: baseSummary.maxCalculationDate,

            // Contract and unit data (always available)
            activeContracts: activeContracts.length,
            managedUnits: managedUnits.length,
            uniquePropertyManagers: [...new Set(activeContracts.map(c => c.propertyManager?._id?.toString()).filter(Boolean))].length,

            // ENHANCED: Invoice statistics with better accuracy
            totalPMInvoices: allPMInvoices.length,
            totalPaidPMInvoices: allPMInvoices.length, // All are paid since we filtered for paid
            totalPMPaidAmount: totalPaidAmount,
            processedPMInvoices: processedInvoices.length,
            unprocessedPMInvoices: unprocessedInvoices.length,

            // Enhanced tracking metrics
            processedInvoiceNumbersCount: alreadyProcessedNumbers.length,
            duplicatePreventionMethod: 'enhanced_invoice_number_tracking',

            // Calculated metrics
            averageRevenuePerRecord: baseSummary.recordCount > 0 ? 
                Math.round((baseSummary.totalRevenue / baseSummary.recordCount) * 100) / 100 : 0,
            averageRevenuePerInvoice: baseSummary.totalInvoicesProcessed > 0 ? 
                Math.round((baseSummary.totalRevenue / baseSummary.totalInvoicesProcessed) * 100) / 100 : 0,
            averageRevenuePerContract: activeContracts.length > 0 ? 
                Math.round((baseSummary.totalRevenue / activeContracts.length) * 100) / 100 : 0,
            averageRevenuePerUnit: managedUnits.length > 0 ? 
                Math.round((baseSummary.totalRevenue / managedUnits.length) * 100) / 100 : 0,
            revenueEfficiency: baseSummary.totalPaidAmount > 0 ? 
                Math.round((baseSummary.totalRevenue / baseSummary.totalPaidAmount) * 10000) / 100 : 100,

            // ENHANCED: Processing metrics with better accuracy
            processingCompletionRate: allPMInvoices.length > 0 ? 
                Math.round((processedInvoices.length / allPMInvoices.length) * 100) : 100,
            
            // Contract details
            contractDetails: activeContracts.map(contract => ({
                id: contract._id,
                name: contract.contractName,
                propertyManager: contract.propertyManager?.fullName || 'Unknown',
                unitsCount: contract.units?.length || 0
            }))
        };

        console.log(`[Complete Summary] Enhanced summary built:`, {
            activeContracts: completeSummary.activeContracts,
            managedUnits: completeSummary.managedUnits,
            totalRevenue: completeSummary.totalRevenue,
            unprocessedInvoices: completeSummary.unprocessedPMInvoices,
            totalPaidAmount: completeSummary.totalPMPaidAmount,
            processingCompletionRate: completeSummary.processingCompletionRate
        });

        return completeSummary;

    } catch (error) {
        console.error('[Complete Summary] Error:', error);
        return {
            totalRevenue: 0,
            totalOwnerAmount: 0,
            totalPaidAmount: 0,
            totalInvoicesProcessed: 0,
            totalUnitsProcessed: 0,
            totalContractsProcessed: 0,
            averageRevenue: 0,
            recordCount: 0,
            activeContracts: 0,
            managedUnits: 0,
            totalPMInvoices: 0,
            totalPaidPMInvoices: 0,
            totalPMPaidAmount: 0,
            processedPMInvoices: 0,
            unprocessedPMInvoices: 0,
            processingCompletionRate: 100
        };
    }
};

/**
 * Enhanced analytics for Property-Management invoice revenue
 */
const getRevenueAnalytics = async (facilityId, baseQuery, models) => {
    try {
        console.log(`[Analytics] Starting analytics generation for facility: ${facilityId}`);
        
        console.log(`[Analytics] Step 1: Getting monthly revenue breakdown`);
        // Revenue by month
        const monthlyRevenue = await models.propertyManagerRevenue.aggregate([
            { $match: baseQuery },
            {
                $group: {
                    _id: {
                        year: { $year: '$calculationDate' },
                        month: { $month: '$calculationDate' }
                    },
                    totalRevenue: { $sum: '$totalRevenue' },
                    totalOwnerAmount: { $sum: '$totalOwnerAmount' },
                    totalPaidAmount: { $sum: '$totalPaidAmount' },
                    invoicesProcessed: { $sum: '$invoicesProcessed' },
                    unitsProcessed: { $sum: '$unitsProcessed' },
                    contractsProcessed: { $sum: '$contractsProcessed' },
                    recordCount: { $sum: 1 }
                }
            },
            { 
                $sort: { '_id.year': -1, '_id.month': -1 } 
            },
            { $limit: 12 }
        ]);

        console.log(`[Analytics] Step 1: Found ${monthlyRevenue.length} months of data`);

        console.log(`[Analytics] Step 2: Getting unit type revenue breakdown`);
        // Revenue by unit type
        const unitTypeRevenue = await models.propertyManagerRevenue.aggregate([
            { $match: baseQuery },
            { $unwind: '$unitBreakdown' },
            {
                $lookup: {
                    from: 'units',
                    localField: 'unitBreakdown.unit',
                    foreignField: '_id',
                    as: 'unitInfo'
                }
            },
            { $unwind: { path: '$unitInfo', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$unitInfo.unitType',
                    totalRevenue: { $sum: '$unitBreakdown.managerRevenue' },
                    totalOwnerAmount: { $sum: '$unitBreakdown.ownerAmount' },
                    totalPaidAmount: { $sum: '$unitBreakdown.totalPaid' },
                    invoiceCount: { $sum: '$unitBreakdown.invoiceCount' },
                    unitCount: { $addToSet: '$unitBreakdown.unit' }
                }
            },
            {
                $project: {
                    _id: 1,
                    totalRevenue: { $round: ['$totalRevenue', 2] },
                    totalOwnerAmount: { $round: ['$totalOwnerAmount', 2] },
                    totalPaidAmount: { $round: ['$totalPaidAmount', 2] },
                    invoiceCount: 1,
                    unitCount: { $size: '$unitCount' },
                    averageRevenuePerUnit: { 
                        $round: [{ $divide: ['$totalRevenue', { $size: '$unitCount' }] }, 2] 
                    }
                }
            }
        ]);

        console.log(`[Analytics] Step 2: Found ${unitTypeRevenue.length} unit types`);

        console.log(`[Analytics] Step 3: Getting property manager revenue breakdown`);
        // Revenue by property manager
        const managerRevenue = await getRevenueByPropertyManager(facilityId, baseQuery, models);

        console.log(`[Analytics] Step 4: Checking for unprocessed Property-Management invoices`);
        // Check for unprocessed Property-Management invoices
        const unprocessedStats = await checkUnprocessedPropertyManagementInvoicesStats(facilityId, models);

        const analytics = {
            monthlyRevenue: monthlyRevenue.map(item => ({
                ...item,
                monthName: new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
            })),
            unitTypeRevenue,
            managerRevenue,
            unprocessedInvoicesStats: unprocessedStats
        };

        console.log(`[Analytics] Analytics generation completed:`, {
            monthlyData: analytics.monthlyRevenue.length,
            unitTypes: analytics.unitTypeRevenue.length,
            managers: analytics.managerRevenue.length,
            unprocessedCount: analytics.unprocessedInvoicesStats?.unprocessedCount || 0
        });

        return analytics;

    } catch (error) {
        console.error('[Analytics] ❌ Error generating analytics:', error);
        return null;
    }
};

/**
 * Get revenue breakdown by property manager
 */
const getRevenueByPropertyManager = async (facilityId, baseQuery, models) => {
    try {
        console.log(`[Manager Revenue] Getting revenue breakdown by property manager`);
        
        // Get all contracts for this facility with property manager details
        const contracts = await models.propertyManagerContract.find({
            facilityId: facilityId,
            status: 'Active'
        }).populate({
            path: 'propertyManager',
            model: payservedb.User,
            select: 'fullName email'
        }).lean();

        console.log(`[Manager Revenue] Found ${contracts.length} active contracts`);

        // Create manager to units mapping
        const managerToUnits = {};
        contracts.forEach(contract => {
            const managerId = contract.propertyManager._id.toString();
            if (!managerToUnits[managerId]) {
                managerToUnits[managerId] = {
                    manager: contract.propertyManager,
                    units: [],
                    contracts: []
                };
            }
            managerToUnits[managerId].units = managerToUnits[managerId].units.concat(contract.units || []);
            managerToUnits[managerId].contracts.push(contract);
        });

        console.log(`[Manager Revenue] Processing ${Object.keys(managerToUnits).length} property managers`);

        // Get revenue data for each manager
        const managerRevenueData = [];
        for (const [managerId, managerData] of Object.entries(managerToUnits)) {
            const managerQuery = {
                ...baseQuery,
                'unitBreakdown.unit': { $in: managerData.units }
            };

            const managerStats = await models.propertyManagerRevenue.aggregate([
                { $match: managerQuery },
                { $unwind: '$unitBreakdown' },
                { $match: { 'unitBreakdown.unit': { $in: managerData.units } } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$unitBreakdown.managerRevenue' },
                        totalOwnerAmount: { $sum: '$unitBreakdown.ownerAmount' },
                        totalPaidAmount: { $sum: '$unitBreakdown.totalPaid' },
                        invoiceCount: { $sum: '$unitBreakdown.invoiceCount' },
                        unitCount: { $addToSet: '$unitBreakdown.unit' }
                    }
                }
            ]);

            if (managerStats.length > 0) {
                const stats = managerStats[0];
                managerRevenueData.push({
                    managerId: managerId,
                    managerName: managerData.manager.fullName,
                    managerEmail: managerData.manager.email,
                    totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
                    totalOwnerAmount: Math.round(stats.totalOwnerAmount * 100) / 100,
                    totalPaidAmount: Math.round(stats.totalPaidAmount * 100) / 100,
                    invoiceCount: stats.invoiceCount,
                    unitCount: stats.unitCount.length,
                    contractCount: managerData.contracts.length,
                    averageRevenuePerUnit: stats.unitCount.length > 0 ? 
                        Math.round((stats.totalRevenue / stats.unitCount.length) * 100) / 100 : 0
                });
            }
        }

        console.log(`[Manager Revenue] Generated revenue data for ${managerRevenueData.length} managers`);
        return managerRevenueData.sort((a, b) => b.totalRevenue - a.totalRevenue);

    } catch (error) {
        console.error('[Manager Revenue] ❌ Error getting revenue by manager:', error);
        return [];
    }
};
/**
 * Check for unprocessed Property-Management invoices specifically - ENHANCED
 */
const checkUnprocessedPropertyManagementInvoicesStats = async (facilityId, models) => {
    try {
        console.log(`[Unprocessed Check] Checking for unprocessed Property-Management invoices with enhanced duplicate prevention`);
        
        // Get all property managed units from contracts
        const activeContracts = await models.propertyManagerContract.find({
            facilityId: facilityId,
            status: 'Active'
        }).select('units').lean();

        const managedUnitIds = activeContracts.reduce((acc, contract) => {
            return acc.concat(contract.units || []);
        }, []);

        console.log(`[Unprocessed Check] Found ${managedUnitIds.length} managed units from ${activeContracts.length} contracts`);

        if (managedUnitIds.length === 0) {
            console.log(`[Unprocessed Check] No managed units found`);
            return {
                unprocessedCount: 0,
                totalPropertyManagementInvoices: 0,
                managedUnitsCount: 0,
                completionRate: 100
            };
        }

        // ENHANCED: Get all processed invoice numbers using aggregation
        const processedInvoiceNumbers = await models.propertyManagerRevenue.aggregate([
            {
                $match: {
                    facility: new mongoose.Types.ObjectId(facilityId)
                }
            },
            { $unwind: '$unitBreakdown' },
            { $unwind: '$unitBreakdown.invoices' },
            {
                $group: {
                    _id: null,
                    invoiceNumbers: { $addToSet: '$unitBreakdown.invoices.invoiceNumber' }
                }
            }
        ]);

        const alreadyProcessedNumbers = processedInvoiceNumbers.length > 0 
            ? processedInvoiceNumbers[0].invoiceNumbers.filter(Boolean)
            : [];

        console.log(`[Unprocessed Check] Found ${alreadyProcessedNumbers.length} processed invoice numbers using enhanced method`);

        // Get all paid Property-Management invoices
        const allPMInvoices = await models.invoice.find({
            'facility.id': new mongoose.Types.ObjectId(facilityId),
            'unit.id': { $in: managedUnitIds.map(id => new mongoose.Types.ObjectId(id)) },
            status: 'Paid',
            amountPaid: { $gt: 0 },
            $or: [
                { 'whatFor.invoiceType': 'Property-Management' },
                { 'whatFor.invoiceType': 'PropertyManagement' },
                { 'whatFor.invoiceType': 'Property Management' }
            ]
        }).select('invoiceNumber propertyManagerRevenueCalculated whatFor.invoiceType status amountPaid').lean();

        console.log(`[Unprocessed Check] Found ${allPMInvoices.length} total paid PM invoices`);

        // ENHANCED: Filter using both methods for maximum accuracy
        const processedInvoices = allPMInvoices.filter(invoice => {
            const isProcessedByFlag = invoice.propertyManagerRevenueCalculated === true;
            const isProcessedByNumber = alreadyProcessedNumbers.includes(invoice.invoiceNumber);
            
            return isProcessedByFlag || isProcessedByNumber;
        });

        const unprocessedInvoices = allPMInvoices.filter(invoice => {
            const isProcessedByFlag = invoice.propertyManagerRevenueCalculated === true;
            const isProcessedByNumber = alreadyProcessedNumbers.includes(invoice.invoiceNumber);
            
            return !isProcessedByFlag && !isProcessedByNumber;
        });

        console.log(`[Unprocessed Check] ENHANCED Results:`, {
            totalPMInvoices: allPMInvoices.length,
            processedInvoices: processedInvoices.length,
            unprocessedInvoices: unprocessedInvoices.length
        });

        // Log some examples for debugging
        console.log(`[Unprocessed Check] Sample unprocessed invoices:`, 
            unprocessedInvoices.slice(0, 5).map(inv => ({
                number: inv.invoiceNumber,
                revenueCalculated: inv.propertyManagerRevenueCalculated || 'false',
                inProcessedNumbers: alreadyProcessedNumbers.includes(inv.invoiceNumber)
            }))
        );

        // Log some examples of processed invoices for verification
        console.log(`[Unprocessed Check] Sample processed invoices:`, 
            processedInvoices.slice(0, 3).map(inv => ({
                number: inv.invoiceNumber,
                revenueCalculated: inv.propertyManagerRevenueCalculated || 'false',
                inProcessedNumbers: alreadyProcessedNumbers.includes(inv.invoiceNumber)
            }))
        );

        const completionRate = allPMInvoices.length > 0 ? 
            Math.round((processedInvoices.length / allPMInvoices.length) * 100) : 100;

        const stats = {
            unprocessedCount: unprocessedInvoices.length,
            totalPropertyManagementInvoices: allPMInvoices.length,
            managedUnitsCount: managedUnitIds.length,
            processedCount: processedInvoices.length,
            completionRate,
            
            // Enhanced tracking
            processedInvoiceNumbersCount: alreadyProcessedNumbers.length,
            duplicatePreventionMethod: 'enhanced_invoice_number_tracking',
            
            // Sample data for debugging
            sampleUnprocessedInvoices: unprocessedInvoices.slice(0, 3).map(inv => ({
                invoiceNumber: inv.invoiceNumber,
                revenueCalculated: inv.propertyManagerRevenueCalculated || 'false',
                inProcessedNumbers: alreadyProcessedNumbers.includes(inv.invoiceNumber)
            })),
            
            sampleProcessedInvoices: processedInvoices.slice(0, 3).map(inv => ({
                invoiceNumber: inv.invoiceNumber,
                revenueCalculated: inv.propertyManagerRevenueCalculated || 'false',
                inProcessedNumbers: alreadyProcessedNumbers.includes(inv.invoiceNumber)
            })),

            // Processing method breakdown
            processedByFlag: allPMInvoices.filter(inv => inv.propertyManagerRevenueCalculated === true).length,
            processedByNumber: processedInvoices.filter(inv => alreadyProcessedNumbers.includes(inv.invoiceNumber)).length,
            
            // Data quality indicators
            flagAndNumberConsistency: Math.abs(
                allPMInvoices.filter(inv => inv.propertyManagerRevenueCalculated === true).length - 
                alreadyProcessedNumbers.length
            ) <= 1, // Allow for small discrepancies
            
            lastUpdated: new Date().toISOString()
        };

        console.log(`[Unprocessed Check] ENHANCED Final Statistics:`, {
            unprocessedCount: stats.unprocessedCount,
            totalPropertyManagementInvoices: stats.totalPropertyManagementInvoices,
            processedCount: stats.processedCount,
            completionRate: stats.completionRate,
            processedInvoiceNumbersCount: stats.processedInvoiceNumbersCount,
            duplicatePreventionMethod: stats.duplicatePreventionMethod,
            flagAndNumberConsistency: stats.flagAndNumberConsistency
        });

        // Additional validation - check for potential issues
        if (stats.unprocessedCount === 0 && stats.totalPropertyManagementInvoices > 0) {
            console.log(`[Unprocessed Check] ✅ All ${stats.totalPropertyManagementInvoices} Property-Management invoices have been processed`);
        } else if (stats.unprocessedCount > 0) {
            console.log(`[Unprocessed Check] ⚠️ ${stats.unprocessedCount} of ${stats.totalPropertyManagementInvoices} Property-Management invoices are ready for processing`);
        }

        // Quality check - warn if there are significant discrepancies
        if (!stats.flagAndNumberConsistency) {
            console.warn(`[Unprocessed Check] ⚠️ Potential data inconsistency detected between flags and processed numbers`);
        }

        return stats;

    } catch (error) {
        console.error('[Unprocessed Check] ❌ Error in enhanced duplicate checking:', error);
        return {
            unprocessedCount: 0,
            totalPropertyManagementInvoices: 0,
            managedUnitsCount: 0,
            completionRate: 100,
            processedCount: 0,
            processedInvoiceNumbersCount: 0,
            duplicatePreventionMethod: 'enhanced_invoice_number_tracking',
            flagAndNumberConsistency: false,
            error: error.message,
            lastUpdated: new Date().toISOString()
        };
    }
};

// Complete the main module export
module.exports = get_property_manager_revenue;