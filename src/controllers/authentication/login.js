const db = require('payservedb')
const bcrypt = require('bcryptjs');

const logger = require("../../../config/winston");
const { loginValidator } = require("../../utils/validator");
const generate_jwt_token = require('../../utils/generate_jwt_token');


const login = async (request, reply) => {
    try {
        const validationResults = await loginValidator.validate(request.body)
        if (validationResults.error) {
            logger.error(validationResults.error.details[0].message);
            return reply.code(400).send({ error: validationResults.error.details[0].message });
        }
        const { userName, password } = validationResults.value;
        console.log(validationResults.value)

        // Check if userName is a phone number and slice the last 9 digits
        const isPhoneNumber = /^[0-9]+$/.test(userName);
        const searchUserName = isPhoneNumber ? userName.slice(-9) : userName;


        const userExist = await db.User.findOne({
            $or: [{ email: userName }, { phoneNumber: searchUserName }]
        })

        if (userExist) {
            const isMatch = await bcrypt.compare(password, userExist.password);

            let familyMember = {}

            if (userExist.role === 'family') {
                familyMember = await db.Customer.findOne(
                    { "familyMembers.email": userExist.email },
                    { "familyMembers.$": 1 } // This uses $elemMatch to project only the matching family member
                );
            }

            if (isMatch) {
                let user = {
                    userId: userExist._id,
                    type: userExist.type,
                    fullName: userExist.fullName,
                    email: userExist.email,
                    phoneNumber: userExist.phoneNumber,
                    role: userExist.role,
                    permissions: userExist.permissions,
                    department: userExist.department,
                    customerData: userExist.customerData !== undefined ? userExist.customerData : [],
                    facilityId: userExist.facilityId !== undefined ? userExist.facilityId : null,
                    familyMember: familyMember
                }

                // For Customer Support users, get their agent information
                if (userExist.type === 'Customer_Support') {
                    const agentInfo = await db.Agent.findOne({ user_id: userExist._id })
                        .populate('facility_id', 'facilityName facilityType');

                    if (agentInfo) {
                        // Check if agent is suspended or terminated
                        if (agentInfo.status === 'suspended') {
                            logger.warn(`Login attempt by suspended agent: ${agentInfo.agent_id}`);
                            return reply.code(403).send({
                                error: 'Your account has been suspended. Please contact your supervisor for assistance.',
                                reason: 'account_suspended',
                                suspended_at: agentInfo.suspended_at,
                                suspended_reason: agentInfo.suspended_reason
                            });
                        }

                        if (agentInfo.status === 'terminated') {
                            logger.warn(`Login attempt by terminated agent: ${agentInfo.agent_id}`);
                            return reply.code(403).send({
                                error: 'Your account has been terminated. Please contact HR for more information.',
                                reason: 'account_terminated',
                                terminated_at: agentInfo.terminated_at,
                                terminated_reason: agentInfo.terminated_reason
                            });
                        }

                        // Get role details from AgentRole collection
                        const roleDetails = await db.AgentRole.findOne({ code: agentInfo.role })
                            .populate('department', 'name code');

                        user.agent = {
                            agent_id: agentInfo.agent_id,
                            role: agentInfo.role,
                            role_name: roleDetails?.name || agentInfo.role,
                            role_level: roleDetails?.level || 1,
                            department: agentInfo.department,
                            department_name: roleDetails?.department?.name || agentInfo.department,
                            team_id: agentInfo.team_id,
                            status: agentInfo.status,
                            skills: agentInfo.skills,
                            languages: agentInfo.languages,
                            is_available: agentInfo.is_available,
                            permissions: agentInfo.permissions || roleDetails?.permissions || [],
                            facility: agentInfo.facility_id
                        };

                        // Override user permissions with agent permissions for Customer Support users
                        user.permissions = agentInfo.permissions || roleDetails?.permissions || [];
                    }
                }
                const result = await generate_jwt_token(user, user.type)
                logger.info(`${userExist.email} has logged in.`)
                return reply.code(200).send({
                    user: user,
                    authToken: result.authToken,
                    refreshToken: result.refreshToken
                })
            }
            else {
                return reply.code(403).send({
                    error: "Email or Password is invalid"
                })
            }
        }
        else {
            return reply.code(403).send({
                error: "Email or Password is invalid"
            })
        }
    }
    catch (err) {
        logger.error(err.message);
        return reply.code(502).send({ error: err.message })

    }
}

module.exports = login