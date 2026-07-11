const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../utils/getModel');

const get_contracts = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { taxType } = request.query;

        const levyContractModel = await getModel(
            'LevyContract',
            payservedb.LevyContract.schema,
            facilityId
        );

        const unitModel = await getModel(
            'Unit',
            payservedb.Unit.schema,
            facilityId
        );

        const levyModel = await getModel(
            'Levy',
            payservedb.Levy.schema,
            facilityId
        );

        const levyTypeModel = await getModel(
            'LevyType',
            payservedb.LevyType.schema,
            facilityId
        );

        // COUNTRY TAX RATE MODEL
        const countryTaxRateModel = await getModel(
            'CountryTaxRate',
            payservedb.CountryTaxRate.schema,
            facilityId
        );

        let query = { facilityId };

        // FILTER BY TAX TYPE
        if (taxType) {
            const taxes = await countryTaxRateModel.find({
                facilityId,
                taxType
            });

            const taxIds = taxes.map(tax => tax._id);

            query.enabledTaxes = {
                $in: taxIds
            };
        }

        // FETCH CONTRACTS
        const contracts = await levyContractModel.find(query);

        if (!contracts || contracts.length === 0) {
            return reply.code(404).send({
                success: false,
                message: 'No contracts found for this facility'
            });
        }

        const enrichedContracts = await Promise.all(
            contracts.map(async (contract) => {
                const contractObj = contract.toObject();

                try {
                    const customer = await payservedb.Customer.findById(contract.customerId);

                    if (customer) {
                        contractObj.customerName = `${customer.firstName} ${customer.lastName}`;
                        contractObj.customerType = customer.customerType;
                        contractObj.customerPhone = customer.phoneNumber;
                        contractObj.customerEmail = customer.email;
                    }

                    const unit = await unitModel.findById(contract.unitId);

                    if (unit) {
                        contractObj.unitName = unit.name;
                        contractObj.division = unit.division;
                        contractObj.floorUnitNo = unit.floorUnitNo;
                    }

                    const levy = await levyModel.findById(contract.levyId);

                    if (levy) {
                        contractObj.levyName = levy.levyName;
                        contractObj.levyApplicant = levy.levyApplicant;

                        if (levy.levyType) {
                            try {
                                const levyTypeId =
                                    levy.levyType instanceof mongoose.Types.ObjectId
                                        ? levy.levyType
                                        : typeof levy.levyType === 'string'
                                        ? levy.levyType
                                        : levy.levyType._id;

                                const levyType = await levyTypeModel.findById(levyTypeId);

                                if (levyType) {
                                    contractObj.levyType = levyType.name;
                                }
                            } catch (typeErr) {
                                console.warn('Error fetching levy type:', typeErr.message);
                            }
                        }
                    }

                    return contractObj;
                } catch (error) {
                    console.warn(
                        `Error enriching contract ${contract._id}:`,
                        error.message
                    );

                    return contractObj;
                }
            })
        );

        return reply.code(200).send({
            success: true,
            message: 'Contracts retrieved successfully',
            contracts: enrichedContracts
        });

    } catch (err) {
        console.error('Error in get_contracts:', err);

        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_contracts;