const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const create_lease_penalty = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            name, 
            type, 
            effectDays, 
            percentage, 
            amount,
            module = 'lease',
            isActive = true
        } = request.body;

        // Validate required fields
        if (!name || !type || !effectDays) {
            return reply.code(400).send({ 
                success: false,
                error: 'Name, type, and effect days are required.' 
            });
        }

        // Validate type and corresponding values
        if (type === 'percentage') {
            if (percentage === undefined || percentage < 0 || percentage > 100) {
                return reply.code(400).send({ 
                    success: false,
                    error: 'For percentage type, provide a valid percentage value between 0 and 100' 
                });
            }
        } else if (type === 'fixed') {
            if (amount === undefined || amount <= 0) {
                return reply.code(400).send({ 
                    success: false,
                    error: 'For fixed type, provide a valid positive amount' 
                });
            }
        } else {
            return reply.code(400).send({ 
                success: false,
                error: 'Type must be either percentage or fixed' 
            });
        }

        // Validate effectDays is within allowed values
        if (![1, 3, 7].includes(Number(effectDays))) {
            return reply.code(400).send({ 
                success: false,
                error: 'Effect days must be either 1, 3, or 7' 
            });
        }

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        // Check for existing penalty with same name in facility
        const existingPenalty = await penaltyModel.findOne({ 
            name,
            facilityId
        });

        if (existingPenalty) {
            return reply.code(400).send({ 
                success: false,
                error: 'A penalty with this name already exists in this facility' 
            });
        }

        // Create the penalty data
        const penaltyData = {
            name,
            type,
            effectDays: Number(effectDays),
            percentage: type === 'percentage' ? Number(percentage) : undefined,
            amount: type === 'fixed' ? Number(amount) : undefined,
            module,
            isActive,
            facilityId,
            moduleId: facilityId // Using facilityId as moduleId since it's a lease penalty
        };

        const penalty = await penaltyModel.create(penaltyData);

        return reply.code(200).send({
            success: true,
            message: 'Lease penalty created successfully',
            data: penalty
        });

    } catch (error) {
        console.error('Error in create_lease_penalty:', error);
        return reply.code(500).send({
            success: false,
            error: 'Failed to create lease penalty',
            details: error.message
        });
    }
};

module.exports = create_lease_penalty;