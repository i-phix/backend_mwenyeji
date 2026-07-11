const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_purchase_order = async (request, reply) => {
    try {
        const { facilityId, purchaseOrderId } = request.params;

        // Basic validation
        if (!purchaseOrderId) {
            return reply.code(400).send({
                error: 'Purchase order ID is required'
            });
        }

        const purchaseOrderModel = await getModel('PurchaseOrder', payservedb.PurchaseOrder.schema, facilityId);
        const supplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);

        // Find the purchase order
        const purchaseOrder = await purchaseOrderModel.findById(purchaseOrderId);

        if (!purchaseOrder) {
            return reply.code(404).send({
                error: 'Purchase order not found'
            });
        }

        // Enrich purchase order with supplier information (same logic as get_all_purchase_orders)
        let supplierInfo = null;

        if (purchaseOrder.supplier) {
            try {
                // The supplier field in PO matches the userId field in Suppliers
                const supplier = await supplierModel.findOne({ userId: purchaseOrder.supplier });
                if (supplier) {
                    supplierInfo = {
                        name: supplier.name,
                        email: supplier.email,
                        phone: supplier.phone,
                        supplierId: supplier.id,
                        status: supplier.status
                    };
                }
            } catch (err) {
                console.error(`Error fetching supplier info for PO ${purchaseOrder.poNumber}:`, err);
            }
        }

        // Create enriched purchase order object
        const enrichedPurchaseOrder = {
            ...purchaseOrder.toObject(),
            supplierInfo
        };

        return reply.code(200).send({
            message: 'Purchase order retrieved successfully',
            data: enrichedPurchaseOrder
        });
    } catch (err) {
        console.error('Error in getting purchase order:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_purchase_order;