const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../utils/getModel');

// Fetch Contracts based on facilityId
const get_contracts = async (request, reply) => {
    try {
        const { facilityId } = request.params; // Get facilityId from route params

        // Get the LevyContract model for the specified facility
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        
        // Also get the Unit model for the facility
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        
        // Get the Levy model for the facility
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);

        // Get the LevyType model for the facility
        const levyTypeModel = await getModel('LevyType', payservedb.LevyType.schema, facilityId);

        // Fetch contracts for the given facilityId from the database
        const contracts = await levyContractModel.find({ facilityId });

        // Check if contracts exist for the facility
        if (!contracts || contracts.length === 0) {
            return reply.code(404).send({ 
                success: false,
                message: 'No contracts found for this facility' 
            });
        }

        // Enrich contracts with additional information
        const enrichedContracts = await Promise.all(contracts.map(async (contract) => {
            // Convert contract to a plain object for modification
            const contractObj = contract.toObject();
            
            try {
                // Fetch customer information
                const customer = await payservedb.Customer.findById(contract.customerId);
                if (customer) {
                    contractObj.customerName = `${customer.firstName} ${customer.lastName}`;
                    contractObj.customerType = customer.customerType;
                    contractObj.customerPhone = customer.phoneNumber;
                    contractObj.customerEmail = customer.email;
                }
                
                // Fetch unit information
                const unit = await unitModel.findById(contract.unitId);
                if (unit) {
                    contractObj.unitName = unit.name;
                    contractObj.division = unit.division;
                    contractObj.floorUnitNo = unit.floorUnitNo;
                }
                
                // Fetch levy information
                const levy = await levyModel.findById(contract.levyId);
                if (levy) {
                    contractObj.levyName = levy.levyName;
                    contractObj.levyApplicant = levy.levyApplicant;
                    
                    // Handle levy type
                    if (levy.levyType) {
                        try {
                            // Check if levyType is an ObjectId or string
                            const levyTypeId = levy.levyType instanceof mongoose.Types.ObjectId 
                                ? levy.levyType 
                                : typeof levy.levyType === 'string' 
                                ? levy.levyType 
                                : levy.levyType._id;

                            // Find the levy type
                            const levyType = await levyTypeModel.findById(levyTypeId);
                            
                            if (levyType) {
                                contractObj.levyType = levyType.name;
                            }
                        } catch (typeErr) {
                            console.warn('Error fetching levy type:', typeErr.message);
                        }
                    }
                }
                
                // Handle currency if available
                if (contract.currency) {
                    try {
                        const currencyModel = await getModel('Currency', payservedb.Currency.schema, facilityId);
                        const currency = await currencyModel.findById(contract.currency);
                        if (currency) {
                            contractObj.currencyName = currency.name || currency.currencyName;
                            contractObj.currencyCode = currency.code || currency.currencyShortCode;
                        }
                    } catch (currErr) {
                        console.warn('Error fetching currency:', currErr.message);
                    }
                }
                
                return contractObj;
            } catch (error) {
                console.warn(`Error enriching contract ${contract._id}:`, error.message);
                // Return the original contract object if enrichment fails
                return contractObj;
            }
        }));

        // Return the success response with enriched contract details
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