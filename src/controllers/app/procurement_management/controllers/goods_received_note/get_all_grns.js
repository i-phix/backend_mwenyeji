const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_all_goods_received_notes = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'createdAt', 
            sortOrder = 'desc',
            status,
            approvalStatus,
            poNumber,
            startDate,
            endDate
        } = request.query;

        const goodsReceivedNoteModel = await getModel('GoodsReceivedNote', payservedb.GoodsReceivedNote.schema, facilityId);

        // Build filter object
        const filter = { facilityId };

        // Add optional filters
        if (status) {
            filter.status = status;
        }

        if (approvalStatus) {
            filter.approvalStatus = approvalStatus;
        }

        if (poNumber) {
            filter.poNumber = new RegExp(poNumber, 'i');
        }

        // Date range filter
        if (startDate || endDate) {
            filter.receivedDate = {};
            if (startDate) {
                filter.receivedDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.receivedDate.$lte = new Date(endDate);
            }
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query with population
        const [goodsReceivedNotes, totalCount] = await Promise.all([
            goodsReceivedNoteModel
                .find(filter)
                .populate('supplier', 'name email contact')
                .populate('receivedBy', 'name email')
                .populate('poId', 'poNumber department items grandTotal')
                .populate('approvals.approvers.userId', 'name email')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            goodsReceivedNoteModel.countDocuments(filter)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        // Format response data
        const formattedGRNs = goodsReceivedNotes.map(grn => ({
            ...grn,
            supplierInfo: grn.supplier,
            receivedByInfo: grn.receivedBy,
            purchaseOrderInfo: grn.poId,
            // Format dates
            receivedDate: grn.receivedDate,
            createdAt: grn.createdAt,
            updatedAt: grn.updatedAt,
            // Calculate completion percentage for approvals
            approvalProgress: grn.approvals.length > 0 ? {
                currentStep: grn.currentStep,
                totalSteps: grn.approvals.length,
                percentage: grn.approvalStatus === 'approved' ? 100 : 
                           grn.approvalStatus === 'rejected' ? 0 :
                           ((grn.currentStep - 1) / grn.approvals.length) * 100
            } : null
        }));

        return reply.code(200).send({
            success: true,
            message: 'Goods received notes retrieved successfully',
            data: {
                data: formattedGRNs,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit),
                    hasNextPage,
                    hasPrevPage
                },
                filters: {
                    status,
                    approvalStatus,
                    poNumber,
                    startDate,
                    endDate
                }
            }
        });
    } catch (err) {
        console.error('Error in getting all goods received notes:', err);
        return reply.code(500).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = get_all_goods_received_notes;