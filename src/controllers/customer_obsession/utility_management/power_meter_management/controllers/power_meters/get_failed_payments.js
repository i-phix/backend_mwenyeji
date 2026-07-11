const mongoose = require('mongoose');
const logger = require('../../../../../../../config/winston');

const PaymentProcessingJobSchema = new mongoose.Schema(
    {},
    {
        strict: false,
        collection: 'paymentprocessingjobs',
    }
);

async function getFailedPowerPayments(request, reply) {
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

        /**
         * PAGINATION
         */
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
        const skip = (pageNumber - 1) * limitNumber;

        /**
         * ✅ FORCE POWER DATABASE
         */
        const db = mongoose.connection.useDb('power');

        const PaymentProcessingJobModel = db.model(
            'paymentprocessingjobs',
            PaymentProcessingJobSchema
        );

        /**
         * BASE QUERY (only failed by default)
         */
        const query = {
            status: 'Failed',
        };

        /**
         * OPTIONAL STATUS FILTER
         */
        if (status) {
            query.status = status;
        }

        /**
         * PAYMENT TYPE FILTER
         */
        if (paymentType) {
            query.paymentType = paymentType;
        }

        /**
         * SEARCH FILTER
         */
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

        /**
         * SORTING
         */
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

        /**
         * FETCH DATA
         */
        const [records, totalRecords] = await Promise.all([
            PaymentProcessingJobModel.find(query)
                .sort({ [safeSortBy]: sortDirection })
                .skip(skip)
                .limit(limitNumber)
                .lean(),

            PaymentProcessingJobModel.countDocuments(query),
        ]);

        const totalPages = Math.ceil(totalRecords / limitNumber);

        logger.info(
            `Retrieved failed power payments: ${records.length}`
        );

        return reply.code(200).send({
            success: true,
            message: 'Failed power payment jobs fetched successfully',
            data: records,
            pagination: {
                currentPage: pageNumber,
                totalPages,
                totalRecords,
                limit: limitNumber,
                hasNextPage: pageNumber < totalPages,
                hasPreviousPage: pageNumber > 1,
            },
        });

    } catch (error) {
        console.log('FAILED POWER PAYMENTS ERROR:', error);

        logger.error(
            `Error retrieving failed power payments: ${error.message}`
        );

        return reply.code(500).send({
            success: false,
            error: error.message,
            stack: error.stack,
        });
    }
}

module.exports = getFailedPowerPayments;