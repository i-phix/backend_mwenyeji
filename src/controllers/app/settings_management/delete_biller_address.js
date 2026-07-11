const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const fs = require('fs');
const path = require('path');

const delete_biller_address = async (request, reply) => {
    try {
        const { facilityId, billerAddressId } = request.params;

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        const billerAddressModel = await getModel("BillerAddress", payservedb.BillerAddress.schema, facilityId);

        // Check if the biller address exists and belongs to this facility
        const existingBillerAddress = await billerAddressModel.findOne({
            _id: billerAddressId,
            facilityId
        });

        if (!existingBillerAddress) {
            return reply.code(404).send({
                success: false,
                error: 'Biller address not found or does not belong to this facility'
            });
        }

        // Prevent deletion of default address unless it's the only one
        if (existingBillerAddress.isDefault) {
            const totalBillerAddresses = await billerAddressModel.countDocuments({ facilityId });
            
            if (totalBillerAddresses > 1) {
                return reply.code(400).send({
                    success: false,
                    error: 'Cannot delete default biller address. Please set another address as default first.'
                });
            }
        }

        // TODO: Add check if biller address is being used in any levies/invoices
        // This would require checking the Levy/Invoice models for any references to this billerAddressId
        
        // Delete logo file if it exists
        if (existingBillerAddress.logo) {
            const logoPath = path.join(__dirname, '../../../uploads/logos', existingBillerAddress.logo);
            fs.unlink(logoPath, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting logo file:', unlinkErr);
            });
        }

        await billerAddressModel.findByIdAndDelete(billerAddressId);

        return reply.code(200).send({
            success: true,
            message: 'Biller address deleted successfully'
        });

    } catch (err) {
        console.error('Error in delete_biller_address:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to delete biller address',
            details: err.message
        });
    }
};

module.exports = delete_biller_address;