const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_supplier = async (request, reply) => {
    try {
        const { facilityId, supplierId } = request.params;
        
        const supplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);
        
        // Find the supplier by ID
        const supplier = await supplierModel.findById(supplierId);
        
        if (!supplier) {
            return reply.code(404).send({ 
                error: 'Supplier not found' 
            });
        }
        
        return reply.code(200).send({
            message: 'Supplier retrieved successfully',
            data: supplier
        });
    } catch (err) {
        console.error('Error in fetching supplier:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_supplier;