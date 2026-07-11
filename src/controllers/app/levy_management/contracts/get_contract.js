const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const mongoose = require('mongoose');

const get_contract = async (request, reply) => {
    try {
        let { contractId, facilityId } = request.params;

        contractId = contractId?.trim();
        facilityId = facilityId?.trim();

        if (!facilityId || !contractId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Contract ID are required.',
                message: 'Missing parameters.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(contractId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid Contract ID format.',
                message: 'Invalid ObjectId.'
            });
        }

        const contractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);

        const facilityModel = payservedb.Facility;
        const unitModel = payservedb.Unit;
        const customerModel = payservedb.Customer;

        const contract = await contractModel.findById(contractId)
            .populate({
                path: 'levyId',
                model: levyModel,
                select: 'levyName bankPayment mobilePayment bankAccountId paymentMethodId billerAddressId'
            })
            .populate({
                path: 'customerId',
                model: customerModel,
                select: 'firstName lastName name'
            })
            .populate({
                path: 'unitId',
                model: unitModel,
                select: 'name unitNumber'
            })
            .populate({
                path: 'facilityId',
                model: facilityModel,
                select: 'facilityName'
            });

        if (!contract) {
            return reply.code(404).send({
                success: false,
                error: 'Contract not found.',
                message: 'No record found'
            });
        }

        return reply.code(200).send({
            success: true,
            data: contract,
            message: 'Contract retrieved successfully'
        });

    } catch (err) {
        console.error('Error fetching contract:', err.message);
        return reply.code(500).send({
            success: false,
            error: err.message,
            message: 'Failed to fetch contract details'
        });
    }
};


module.exports = get_contract;