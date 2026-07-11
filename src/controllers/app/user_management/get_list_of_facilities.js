const payservedb = require('payservedb');
const logger = require('../../../../config/winston');


const get_list_of_facilities = async (request, reply) => {
    try {
        const { user } = request;

        const userExist = await payservedb.User.findById(user.userId);
        if (userExist) {
            let companies = userExist.companies;

            // Fetch all companies concurrently
            const facilitiesPromises = companies.map(async (company) => {
                let companyExist = await payservedb.Company.findById(company);
                if (companyExist) {
                    // Fetch all facilities for each company concurrently
                    return Promise.all(
                        companyExist.facilities.map(async (item) => {
                            return await payservedb.Facility.findById(item);
                        })
                    );
                } else {
                    return []; // If company doesn't exist, return an empty array
                }
            });

            // Resolve all promises and flatten the result
            let array = (await Promise.all(facilitiesPromises)).flat();
            return reply.code(200).send(array)
        }
    } catch (err) {
        logger.error(`Error in get_list_of_facilities: ${err.message}`);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_list_of_facilities;
