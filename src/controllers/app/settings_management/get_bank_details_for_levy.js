 const mongoose = require("mongoose");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const getBankDetailsForLevy = async (request, reply) => {
    try {
        const { facilityId, bankDetailsId } = request.params;

        if (!facilityId || !bankDetailsId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Bank Details ID are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(bankDetailsId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid bankDetailsId format'
            });
        }

        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        const bankDetailsModel = await getModel("BankDetails", payservedb.BankDetails.schema, facilityId);

        const bankDetails = await bankDetailsModel.findOne({
            _id: new mongoose.Types.ObjectId(bankDetailsId),
            facilityId: facilityId
        });

        if (!bankDetails) {
            return reply.code(404).send({
                success: false,
                error: 'Bank details not found for this facility'
            });
        }

        return reply.code(200).send({
            success: true,
            data: bankDetails
        });

    } catch (err) {
        console.error('Error fetching bank details for levy:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve bank details',
            details: err.message
        });
    }
};

module.exports = getBankDetailsForLevy;
