const payservedb = require("payservedb");

const getInvoices = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            page = 1, 
            limit = 10, 
            status, 
            invoiceType,
            startDate,
            endDate 
        } = request.query;

        // Build query
        const query = { facilityId };

        if (status) {
            query.status = status;
        }

        if (invoiceType) {
            query.invoiceType = invoiceType;
        }

        if (startDate || endDate) {
            query.invoiceDate = {};
            if (startDate) {
                query.invoiceDate.$gte = new Date(startDate);
            }
            if (endDate) {
                query.invoiceDate.$lte = new Date(endDate);
            }
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get invoices with pagination
        const invoices = await payservedb.FacilityInvoice.find(query)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await payservedb.FacilityInvoice.countDocuments(query);

        // Calculate summary statistics
        const summary = await payservedb.FacilityInvoice.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);

        const summaryObj = {
            pending: { count: 0, amount: 0 },
            paid: { count: 0, amount: 0 },
            overdue: { count: 0, amount: 0 },
            total: { count: 0, amount: 0 }
        };

        summary.forEach(item => {
            if (summaryObj[item._id]) {
                summaryObj[item._id] = {
                    count: item.count,
                    amount: item.totalAmount
                };
            }
            summaryObj.total.count += item.count;
            summaryObj.total.amount += item.totalAmount;
        });

        return reply.code(200).send({
            success: true,
            invoices,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            summary: summaryObj
        });

    } catch (err) {
        console.error("Error getting invoices:", err);
        return reply.code(500).send({ 
            error: "Failed to retrieve invoices",
            details: err.message 
        });
    }
};

module.exports = getInvoices;