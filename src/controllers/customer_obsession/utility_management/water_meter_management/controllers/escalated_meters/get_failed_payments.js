const mongoose = require('mongoose');
const logger = require('../../../../../../../config/winston');

const PaymentProcessingJobSchema = new mongoose.Schema(
    {},
    {
        strict: false,
        collection: 'paymentprocessingjobs',
    }
);

async function getFailedWaterPayments(request, reply) {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            paymentType,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status,
        } = request.query || {};

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
        const skip = (pageNumber - 1) * limitNumber;

        /**
         * ✅ FORCE CORRECT DATABASE
         */
        const db = mongoose.connection.useDb('utility_database');

        const PaymentProcessingJobModel = db.model(
            'paymentprocessingjobs',
            PaymentProcessingJobSchema
        );

        /**
         * QUERY
         */
        const query = {
            status: 'Failed',
        };

        if (status) {
            query.status = status;
        }

        if (paymentType) {
            query.paymentType = paymentType;
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');

            query.$or = [
                { accountNo: regex },
                { paymentReference: regex },
                { paymentType: regex },
                { status: regex },
                { currentStep: regex },
                { lastError: regex },
                { jobId: regex },
            ];
        }

        const allowedSortFields = [
            'createdAt',
            'updatedAt',
            'accountNo',
            'paymentType',
            'status',
            'attempts',
        ];

        const safeSortBy = allowedSortFields.includes(sortBy)
            ? sortBy
            : 'createdAt';

        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const [records, totalRecords] = await Promise.all([
            PaymentProcessingJobModel.find(query)
                .sort({ [safeSortBy]: sortDirection })
                .skip(skip)
                .limit(limitNumber)
                .lean(),

            PaymentProcessingJobModel.countDocuments(query),
        ]);

        return reply.code(200).send({
            success: true,
            message: 'Failed water payment jobs fetched successfully',
            data: records,
            pagination: {
                currentPage: pageNumber,
                totalPages: Math.ceil(totalRecords / limitNumber),
                totalRecords,
                limit: limitNumber,
                hasNextPage: pageNumber < Math.ceil(totalRecords / limitNumber),
                hasPreviousPage: pageNumber > 1,
            },
        });

    } catch (error) {
        console.log('FAILED WATER PAYMENTS ERROR:', error);

        logger.error(error.message);

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
}

module.exports = getFailedWaterPayments;