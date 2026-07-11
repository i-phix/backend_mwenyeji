const payservedb = require('payservedb');
const mongoose = require('mongoose');

const get_rfq_responses_by_supplier = async (request, reply) => {
    try {
        const { supplierId } = request.params;
        const { status, page = 1, limit = 10 } = request.query;

        // Validate supplier ID
        if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
            return reply.code(400).send({
                success: false,
                error: 'Valid supplier ID is required'
            });
        }

        // Build aggregate pipeline to filter RFQs by supplier
        const pipeline = [
            {
                $match: {
                    'suppliers.supplierId': mongoose.Types.ObjectId(supplierId)
                }
            },
            // Add status filter if provided
            ...(status && ['open', 'closed', 'awarded', 'canceled'].includes(status) ? [
                { $match: { status } }
            ] : []),
            // Lookup RFQ details
            {
                $lookup: {
                    from: 'rfqdetails',
                    localField: 'rfqId',
                    foreignField: '_id',
                    as: 'rfqDetails'
                }
            },
            // Unwind the RFQ details
            {
                $unwind: {
                    path: '$rfqDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Filter to only include the specific supplier's response
            {
                $addFields: {
                    supplierResponse: {
                        $filter: {
                            input: '$suppliers',
                            as: 'supplier',
                            cond: { $eq: ['$$supplier.supplierId', mongoose.Types.ObjectId(supplierId)] }
                        }
                    }
                }
            },
            // Project only needed fields
            {
                $project: {
                    _id: 1,
                    rfqId: 1,
                    facilityId: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    'rfqDetails.name': 1,
                    'rfqDetails.rfqNumber': 1,
                    'rfqDetails.startDate': 1,
                    'rfqDetails.closingDate': 1,
                    'rfqDetails.currency': 1,
                    'rfqDetails.status': 1,
                    'rfqDetails.category': 1,
                    'rfqDetails.items': 1,
                    supplierResponse: 1,
                    awarded: '$awardDetails.awarded',
                    awardedSupplierId: '$awardDetails.awardedSupplierId',
                    isWinner: { 
                        $eq: ['$awardDetails.awardedSupplierId', mongoose.Types.ObjectId(supplierId)]
                    }
                }
            }
        ];

        // Get total count for pagination
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await payservedb.RFQResponse.aggregate(countPipeline);
        const totalCount = countResult.length > 0 ? countResult[0].total : 0;

        // Add pagination to pipeline
        const skip = (parseInt(page) - 1) * parseInt(limit);
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        );

        // Execute the query
        const responses = await payservedb.RFQResponse.aggregate(pipeline);

        return reply.code(200).send({
            success: true,
            data: responses,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error in getting RFQ responses by supplier:', err);
        return reply.code(400).send({
            success: false,
            error: err.message || 'An error occurred while fetching RFQ responses'
        });
    }
};

module.exports = get_rfq_responses_by_supplier;