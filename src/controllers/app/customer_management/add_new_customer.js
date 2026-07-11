const payservedb = require('payservedb');
const bcrypt = require('bcryptjs');
const { sendSms } = require('../../../utils/send_new_sms')
const { sendEmail } = require("../../../utils/send_new_email");
const { sendUserCredentials } = require('../../../utils/send_credentials');
const { getModel } = require('../../../utils/getModel');

const add_customer = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      idNumber,
      nextOfKinName,
      nextOfKinRelationship,
      nextOfKinPhoneNumber,
      nextOfKinEmail,
      canReceiveInvoice,
      combineInvoices, 
      kraPin, 
      units,
      customerType,
      residentType,
      nonResidentUsage,
    } = request.body;

    const generateRandomNumber = () => Math.floor(Math.random() * (1000000 - 10000)) + 10000;

    const filteredPhoneNumber = phoneNumber.trim().slice(-9);

    // Check if customer already exists in THIS facility
    const existingCustomerInFacility = await payservedb.Customer.findOne({
      phoneNumber: filteredPhoneNumber,
      facilityId: facilityId
    });

    if (existingCustomerInFacility) {
      return reply.code(400).send({
        success: false,
        error: 'A customer with this phone number already exists in this facility.',
        message: 'A customer with this phone number already exists in this facility.'
      });
    }

    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    for (let unit of units) {
      const existingUnit = await unitModel.findOne({ _id: unit._id });

      if (!existingUnit) {
        return reply.code(400).send({
          success: false,
          error: `Unit ${unit.name} does not exist.`,
          message: `Unit ${unit.name} does not exist.`
        });
      }

      if (existingUnit.homeOwnerId && existingUnit.tenantId) {
        return reply
          .code(400)
          .send({
            success: false,
            error: `Unit ${unit.name} is already occupied by both a homeowner and a tenant.`,
            message: `Unit ${unit.name} is already occupied by both a homeowner and a tenant.`
          });
      }

      if (customerType === "home owner") {
        if (existingUnit.homeOwnerId) {
          return reply
            .code(400)
            .send({
              success: false,
              error: `Unit ${unit.name} is already assigned to a homeowner.`,
              message: `Unit ${unit.name} is already assigned to a homeowner.`
            });
        }
        if (existingUnit.tenantId) {
          if (residentType === "resident") {
            return reply
              .code(400)
              .send({
                success: false,
                error: `Unit ${unit.name} already has a tenant. Homeowner cannot be a Resident.`,
                message: `Unit ${unit.name} already has a tenant. Homeowner cannot be a Resident.`
              });
          }
          request.body.residentType = "non-resident"; // Auto-set residentType to non-resident if tenant exists
        }
      }

      if (customerType === "tenant" && existingUnit.tenantId) {
        return reply
          .code(400)
          .send({
            success: false,
            error: `Unit ${unit.name} is already assigned to a tenant.`,
            message: `Unit ${unit.name} is already assigned to a tenant.`
          });
      }
    }

    const fullName = `${firstName} ${lastName}`;
    const customerNumber = generateRandomNumber();

    const data = new payservedb.Customer({
      customerNumber,
      firstName,
      lastName,
      email,
      phoneNumber: filteredPhoneNumber,
      idNumber,
      nextOfKin:
        nextOfKinName || nextOfKinRelationship || nextOfKinPhoneNumber || nextOfKinEmail
          ? [
            {
              name: nextOfKinName,
              relationship: nextOfKinRelationship,
              phoneNumber: nextOfKinPhoneNumber,
              email: nextOfKinEmail,
              canReceiveInvoice: canReceiveInvoice,
            },
          ]
          : [],
      combineInvoices: combineInvoices || false, 
      kraPin: kraPin || null,
      customerType,
      residentType,
      nonResidentUsage,
      facilityId,
      status: "Active",
    });

    const response = await data.save();

    // Add a new user or update existing
    const filterUser = await payservedb.User.findOne({ email });

    if (filterUser) {
      const query = { _id: filterUser._id };
      let customerData = filterUser.customerData || [];

      // Check if user already has a record for this facility
      const existingFacilityIndex = customerData.findIndex(
        item => item.facilityId.toString() === facilityId.toString()
      );

      if (existingFacilityIndex >= 0) {
        // Update existing facility record
        customerData[existingFacilityIndex].customerId = response._id;
        customerData[existingFacilityIndex].isEnabled = true;
      } else {
        // Add new facility record
        customerData.push({
          facilityId,
          customerId: response._id,
          isEnabled: true,
        });
      }

      // If user is a landlord in any facility, ensure type is set to "Landlord"
      let updateData = {
        customerData,
        combineInvoices: combineInvoices || false // Added: Update user's combineInvoices preference
      };
      if (residentType === "non-resident" && customerType === "home owner") {
        updateData.type = "Landlord";
      }

      await payservedb.User.updateOne(query, updateData);
    } else {
      const password = 'PXDS' + customerNumber;
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      let userType = residentType === "resident" ? "Resident" : "Landlord"; // Ensure non-resident homeowners are "Landlord"

      const dataUser = new payservedb.User({
        fullName,
        email,
        phoneNumber: filteredPhoneNumber,
        idNumber,
        type: userType,
        role: "admin",
        kyc: {},
        companies: [],
        customerData: [
          {
            facilityId,
            customerId: response._id,
            isEnabled: true,
          },
        ],
        combineInvoices: combineInvoices || false, // Added: Set combineInvoices for new user
        password: hashedPassword,
      });

      const responseUser = await dataUser.save();

      await sendUserCredentials({
        facilityId,
        user: responseUser,
        password,        // the plain-text password generated before hashing
        userType
      });

      // const userConfig = {
      //   landlord: {
      //     url: process.env.landlordFrontEndUrl,
      //     resetUrl: 'https://landlord.payserve.co.ke/reset_password'
      //   },
      //   tenant: {
      //     url: process.env.residentFrontEndUrl,
      //     resetUrl: 'https://resident.payserve.co.ke/reset_password'
      //   }
      // };

      // const config = userConfig[userType] || userConfig.tenant; // fallback to tenant

      // // Get the Northlands facility ID from your .env file
      // const northlandsFacilityId = process.env.northlandsFacilityId;

      // // Create the base message
      // let message = `PayServe LOGIN CREDENTIALS: Dear ${userType}, please login to ${config.url}
      //  Username: ${email},
      //  Password: ${password}
      //  Reset your password here:
      //  ${config.resetUrl}/${responseUser._id}`;

      // // If the facility is Northlands, append the app store links
      // if (facilityId === northlandsFacilityId) {
      //   message += `

      //  Download our mobile app:
      //  • Android: https://play.google.com/store/apps/details?id=com.northlandsapp.app
      //  • iOS: https://apps.apple.com/us/app/northland-heights/id6756302852`;
      // }

      // // Send the message
      // sendSms(facilityId, responseUser.phoneNumber, message);
      // sendEmail(facilityId, responseUser.email, 'PAYSERVE LOGIN CREDENTIALS', message);

    }

    if (units.length > 0) {
      for (let unit of units) {
        const query = { _id: unit._id };
        const data = {};

        if (customerType === 'home owner') {
          data.homeOwnerId = response._id;
        } else if (customerType === 'tenant') {
          data.tenantId = response._id;
        }

        // Assign residentId only if they are a resident
        if (customerType === 'tenant' || residentType === 'resident') {
          data.residentId = response._id;
        }

        // First, fetch the current unit data to access existing occupants
        const currentUnit = await unitModel.findOne({ _id: unit._id });
        data.occupants = currentUnit.occupants || [];

        // New occupant record with proper move-in date
        const newOccupant = {
          customerId: response._id,
          customerType: customerType,
          moveInDate: new Date(),
          moveOutDate: null,
        };

        // Check if this customer already exists in occupants
        const existingOccupantIndex = data.occupants.findIndex(
          occupant =>
            occupant.customerId &&
            occupant.customerId.toString() === response._id.toString() &&
            occupant.customerType === customerType &&
            occupant.moveOutDate === null
        );

        // If customer already exists as an active occupant of this type, don't add again
        if (existingOccupantIndex === -1) {
          data.occupants.push(newOccupant);
        }


        await unitModel.updateOne(query, data);
      }
    }

    // Auto-create move-in handover for tenant customers (and resident homeowners)
    // This ensures proper handover documentation from the start of occupancy
    let handoverResults = [];

    // Only attempt handover creation if customer creation was successful
    try {
      if ((customerType === 'tenant' || (customerType === 'home owner' && residentType === 'resident')) && units.length > 0) {
        console.log(`Customer is a ${customerType}${customerType === 'home owner' ? ' (resident)' : ''}, creating move-in handovers for ${units.length} units`);

        for (let unit of units) {
          try {
            // Get the handover model for this facility
            const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);

            // Check if move-in handover already exists for this customer and unit
            const existingHandover = await handoverModel.findOne({
              unitId: unit._id,
              customerId: response._id,
              handoverType: 'MoveIn'
            });

            let handoverResult;
            if (existingHandover) {
              console.log(`Move-in handover already exists for customer ${response._id} in unit ${unit._id}`);
              handoverResult = {
                success: true,
                handover: existingHandover,
                message: 'Move-in handover already exists'
              };
            } else {
              // Create handover data with defaults
              const handoverData = {
                facilityId,
                unitId: unit._id,
                customerId: response._id,
                handoverType: 'MoveIn',
                handoverDate: new Date(),
                items: [],
                meterReadings: {
                  electricity: { reading: 0 },
                  water: { reading: 0 },
                  gas: { reading: 0 }
                },
                keysHandedOver: 0,
                notes: `Auto-created move-in handover for ${customerType} ${fullName} on ${new Date().toLocaleDateString()}`,
                attachments: [],
                signatures: {
                  propertyManager: {},
                  customer: { agreement: false }
                },
                status: 'Draft'
              };

              // Create handover in the facility database
              const handover = await handoverModel.create(handoverData);
              console.log(`Move-in handover created automatically for customer ${response._id} in unit ${unit._id}:`, handover._id);

              handoverResult = {
                success: true,
                handover: handover,
                message: 'Move-in handover created successfully'
              };
            }

            handoverResults.push({
              unitId: unit._id,
              unitName: unit.name,
              success: handoverResult.success,
              handoverId: handoverResult.success ? handoverResult.handover._id : null,
              message: handoverResult.message,
              error: handoverResult.error || null
            });

            if (handoverResult.success) {
              console.log(`Move-in handover created for ${customerType} ${fullName} in unit ${unit.name}: ${handoverResult.handover._id}`);
            } else {
              console.error(`Failed to create move-in handover for ${customerType} ${fullName} in unit ${unit.name}:`, handoverResult.error);
            }
          } catch (handoverError) {
            console.error(`Error creating move-in handover for unit ${unit._id}:`, handoverError);
            handoverResults.push({
              unitId: unit._id,
              unitName: unit.name,
              success: false,
              handoverId: null,
              message: 'Failed to create move-in handover',
              error: handoverError.message
            });
          }
        }
      }
    } catch (handoverProcessError) {
      console.error('Error in handover creation process:', handoverProcessError);
      // Don't let handover creation errors affect customer creation success
    }

    // Log handover creation results but maintain original response format for frontend compatibility
    if (handoverResults.length > 0) {
      const successfulHandovers = handoverResults.filter(h => h.success).length;
      const failedHandovers = handoverResults.filter(h => !h.success).length;

      console.log(`Handover creation summary for customer ${response._id}:`);
      console.log(`- Successful: ${successfulHandovers}`);
      console.log(`- Failed: ${failedHandovers}`);
      console.log(`- Skipped: ${handoverResults.filter(h => h.message === 'Move-in handover already exists').length}`);

      if (failedHandovers > 0) {
        console.log('Failed handover details:');
        handoverResults.filter(h => !h.success).forEach((result, index) => {
          console.log(`  ${index + 1}. Unit ${result.unitName}: ${result.error}`);
        });
      }
    }

    // Return proper JSON response format to match makeRequest2 expectations
    return reply.code(201).send({
      success: true,
      message: 'Customer added successfully',
      data: {
        customer: response,
        handovers: handoverResults.length > 0 ? {
          total: handoverResults.length,
          successful: handoverResults.filter(h => h.success).length,
          failed: handoverResults.filter(h => !h.success).length,
          results: handoverResults
        } : null
      }
    });
  } catch (err) {
    console.log(err);
    return reply.code(502).send({
      success: false,
      error: err.message,
      message: err.message
    });
  }
};

module.exports = add_customer;