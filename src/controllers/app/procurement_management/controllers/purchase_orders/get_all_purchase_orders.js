const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_all_purchase_orders = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            status,
            department,
            dateFrom,
            dateTo,
            page = 1,
            limit = 10,
            search
        } = request.query;

        const purchaseOrderModel = await getModel('PurchaseOrder', payservedb.PurchaseOrder.schema, facilityId);
        const supplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);

        // Build query
        const query = { facilityId };

        // Add filters if they exist
        if (status) {
            query.status = status;
        }

        if (department) {
            query.department = department;
        }

        // Add date range filter
        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) {
                query.date.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                query.date.$lte = new Date(dateTo);
                // Set time to end of day for the end date
                query.date.$lte.setHours(23, 59, 59, 999);
            }
        }

        // Add search capability
        if (search) {
            query.$or = [
                { poNumber: { $regex: search, $options: 'i' } },
                { prNumber: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
                { 'items.itemDescription': { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalCount = await purchaseOrderModel.countDocuments(query);

        // Fetch purchase orders with pagination
        const purchaseOrders = await purchaseOrderModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Enrich purchase orders with supplier information
        const enrichedPurchaseOrders = await Promise.all(
            purchaseOrders.map(async (po) => {
                let supplierInfo = null;
                
                if (po.supplier) {
                    try {
                        // The supplier field in PO matches the userId field in Suppliers
                        const supplier = await supplierModel.findOne({ userId: po.supplier });
                        if (supplier) {
                            supplierInfo = {
                                name: supplier.name,
                                email: supplier.email,
                                phone: supplier.phone,
                                status: supplier.status
                            };
                        }
                    } catch (err) {
                        console.error(`Error fetching supplier info for PO ${po.poNumber}:`, err);
                    }
                }
                
                return {
                    ...po.toObject(),
                    supplierInfo
                };
            })
        );

        return reply.code(200).send({
            message: 'Purchase orders retrieved successfully',
            data: enrichedPurchaseOrders,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error('Error in getting all purchase orders:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_all_purchase_orders;