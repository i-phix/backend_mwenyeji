const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../../../utils/getModel');

const edit_supplier = async (request, reply) => {
    try {
        const { facilityId, supplierId } = request.params;
        const { 
            name, 
            email, 
            phone, 
            contactPerson,
            department,
            taxIdentificationNumber,
            status
        } = request.body;

        const supplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);
        
        // Check if supplier exists
        const supplier = await supplierModel.findById(supplierId);
        if (!supplier) {
            return reply.code(404).send({ 
                error: 'Supplier not found' 
            });
        }

        // Check if email is being changed and if it's already in use
        if (email && email !== supplier.email) {
            const existingSupplier = await supplierModel.findOne({ email, _id: { $ne: supplierId } });
            if (existingSupplier) {
                return reply.code(400).send({ 
                    error: 'This email is already in use by another supplier' 
                });
            }
        }

        // Process any uploaded documents
        const newDocuments = [];
        if (request.files && request.files.length > 0) {
            for (const file of request.files) {
                const document = `uploads/${path.basename(file.path)}`;
                const documentName = request.body[`documentName_${file.fieldname.split('_')[1]}`] || file.originalname;
                const documentType = request.body[`documentType_${file.fieldname.split('_')[1]}`] || 'other';
                
                newDocuments.push({
                    documentName,
                    documentType,
                    document
                });
            }
        }

        // Create update object
        const updateData = {};
        
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (contactPerson?.name) updateData['contactPerson.name'] = contactPerson.name;
        if (department?.name) updateData['department.name'] = department.name;
        if (taxIdentificationNumber) updateData.taxIdentificationNumber = taxIdentificationNumber;

        // Add status if it's provided
        if (status && ['active', 'inactive', 'blacklisted'].includes(status)) {
            updateData.status = status;
        }

        // Add new documents to existing ones if there are any
        if (newDocuments.length > 0) {
            updateData.$push = { documents: { $each: newDocuments } };
        }

        // Update the supplier
        const updatedSupplier = await supplierModel.findByIdAndUpdate(
            supplierId,
            updateData,
            { new: true }
        );
        
        return reply.code(200).send({
            message: 'Supplier updated successfully',
            data: updatedSupplier
        });
    } catch (err) {
        console.error('Error in updating supplier:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = edit_supplier;