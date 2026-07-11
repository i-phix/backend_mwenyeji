const payservedb = require('payservedb');
const bcrypt = require('bcryptjs');
const { getModel } = require('../../../utils/getModel');

const import_customers = async (request, reply) => {

  try {
    const { facilityId } = request.params;
    const { customers } = request.body;

    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      console.error('❌ IMPORT: No customers provided');
      return reply.code(400).send({
        success: false,
        error: 'No customers provided for import',
        message: 'No customers provided for import'
      });
    }

    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    const generateRandomNumber = () => Math.floor(Math.random() * (1000000 - 10000)) + 10000;
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Get all units in facility for quick lookup
    const allUnits = await unitModel.find({});
    const unitNameMap = new Map();
    const unitIdMap = new Map();
    allUnits.forEach(unit => {
      unitNameMap.set(unit.name.toLowerCase(), {
        _id: unit._id,
        name: unit.name,
        homeOwnerId: unit.homeOwnerId,
        tenantId: unit.tenantId,
        residentId: unit.residentId,
        occupants: unit.occupants || []
      });
      unitIdMap.set(unit._id.toString(), unit.name);
    });

    // Track unit assignments during import to handle dependencies
    const unitAssignments = new Map();
    // Track customer IDs by email for quick lookup
    const customerIdByEmail = new Map();

    // First pass: Import all customers and validate
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const rowNumber = i + 2;

      try {
        // Basic validation
        if (!customer.firstName || !customer.lastName || !customer.email || !customer.phoneNumber) {
          const errorMsg = 'Missing required fields';
          results.failed.push({
            row: rowNumber,
            data: { firstName: customer.firstName, lastName: customer.lastName },
            error: errorMsg
          });
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer.email)) {
          results.failed.push({
            row: rowNumber,
            data: { email: customer.email },
            error: 'Invalid email format'
          });
          continue;
        }

        // Process phone number
        const phoneStr = customer.phoneNumber.toString().trim();
        const filteredPhoneNumber = phoneStr.slice(-9);

        if (filteredPhoneNumber.length !== 9) {
          results.failed.push({
            row: rowNumber,
            data: { phoneNumber: customer.phoneNumber },
            error: 'Invalid phone number format'
          });
          continue;
        }

        // Check if customer already exists in this facility
        const existingCustomerInFacility = await payservedb.Customer.findOne({
          $or: [
            { phoneNumber: filteredPhoneNumber, facilityId: facilityId },
            { email: customer.email.toLowerCase(), facilityId: facilityId }
          ]
        });

        if (existingCustomerInFacility) {
          results.skipped.push({
            row: rowNumber,
            data: { email: customer.email, phoneNumber: filteredPhoneNumber },
            reason: 'Customer with this phone number or email already exists in this facility'
          });
          continue;
        }

        // Normalize customer data
        const normalizedCustomer = {
          firstName: customer.firstName.trim(),
          lastName: customer.lastName.trim(),
          email: customer.email.toLowerCase().trim(),
          phoneNumber: filteredPhoneNumber,
          idNumber: (customer.idNumber || '').toString().trim(),
          customerType: (customer.customerType || 'tenant').toLowerCase(),
          residentType: (customer.residentType || 'resident').toLowerCase(),
          nonResidentUsage: customer.nonResidentUsage || '',
          canReceiveInvoice: Boolean(customer.canReceiveInvoice)
        };

        // Validate customer type and resident type
        if (!['home owner', 'tenant'].includes(normalizedCustomer.customerType)) {
          results.failed.push({
            row: rowNumber,
            data: { customerType: normalizedCustomer.customerType },
            error: 'Customer type must be "home owner" or "tenant"'
          });
          continue;
        }

        if (!['resident', 'non-resident'].includes(normalizedCustomer.residentType)) {
          results.failed.push({
            row: rowNumber,
            data: { residentType: normalizedCustomer.residentType },
            error: 'Resident type must be "resident" or "non-resident"'
          });
          continue;
        }

        // Validate units if provided
        let processedUnits = [];
        if (customer.units && Array.isArray(customer.units)) {

          for (let unitRef of customer.units) {
            const unitName = unitRef.name ? unitRef.name.trim().toLowerCase() : null;

            if (!unitName) {
              console.log(`⚠️ WARNING: Empty unit name for customer ${customer.email}`);
              continue;
            }

            const unitData = unitNameMap.get(unitName);

            if (!unitData) {
              const errorMsg = `Unit "${unitRef.name}" does not exist in this facility`;
              results.failed.push({
                row: rowNumber,
                data: { units: unitRef.name },
                error: errorMsg
              });
              throw new Error(`Unit validation failed`);
            }

            // Check against existing assignments during this import
            const assignment = unitAssignments.get(unitData._id.toString()) || {
              homeOwnerId: unitData.homeOwnerId,
              tenantId: unitData.tenantId,
              residentId: unitData.residentId,
              homeOwnerEmail: null,
              tenantEmail: null
            };

            const isHomeOwner = normalizedCustomer.customerType === "home owner";
            const isResident = normalizedCustomer.residentType === "resident";

            if (isHomeOwner) {
              // Check if homeowner already exists in this unit
              if (assignment.homeOwnerId && assignment.homeOwnerId !== 'pending') {
                const errorMsg = `Unit "${unitData.name}" already has a homeowner`;
                throw new Error(errorMsg);
              }

              // If there's a tenant and homeowner wants to be resident, that's not allowed
              if (assignment.tenantId && assignment.tenantId !== 'pending' && isResident) {
                const errorMsg = `Unit "${unitData.name}" has a tenant. Homeowner cannot be resident when tenant exists`;
                throw new Error(errorMsg);
              }

              // Track homeowner email for later assignment
              assignment.homeOwnerEmail = normalizedCustomer.email;
            } else { // tenant
              // Check if tenant already exists in this unit
              if (assignment.tenantId && assignment.tenantId !== 'pending') {
                const errorMsg = `Unit "${unitData.name}" already has a tenant`;
                throw new Error(errorMsg);
              }

              // Check if homeowner exists (either in DB or in current import)
              const hasHomeOwner = assignment.homeOwnerId || assignment.homeOwnerEmail;
              if (!hasHomeOwner || hasHomeOwner === 'pending') {
                // Look for homeowner in current import batch
                const homeownerInBatch = customers.find(c => {
                  const cUnits = c.units || [];
                  return cUnits.some(u => {
                    const uName = u.name?.trim().toLowerCase();
                    return uName === unitName;
                  }) &&
                    c.customerType?.toLowerCase() === 'home owner' &&
                    c.email?.toLowerCase() !== normalizedCustomer.email;
                });

                if (!homeownerInBatch) {
                  const errorMsg = `Unit "${unitData.name}" must have a homeowner before assigning a tenant`;
                  throw new Error(errorMsg);
                }
              } else {
                console.log(`✅ Homeowner exists: ${assignment.homeOwnerEmail || assignment.homeOwnerId}`);
              }

              // Track tenant email for later assignment
              assignment.tenantEmail = normalizedCustomer.email;
            }

            // Track assignment for this import session
            if (isHomeOwner) {
              assignment.homeOwnerId = 'pending';
            } else {
              assignment.tenantId = 'pending';
            }

            if (isResident || !isHomeOwner) { // Tenants are always resident
              assignment.residentId = 'pending';
            }

            unitAssignments.set(unitData._id.toString(), assignment);

            processedUnits.push({
              _id: unitData._id,
              name: unitData.name
            });
          }
        } else {
          console.log(`ℹ️ No units specified for customer ${customer.email}`);
        }

        // Create customer object
        const customerNumber = generateRandomNumber();
        const fullName = `${normalizedCustomer.firstName} ${normalizedCustomer.lastName}`;

        const customerData = new payservedb.Customer({
          customerNumber,
          firstName: normalizedCustomer.firstName,
          lastName: normalizedCustomer.lastName,
          email: normalizedCustomer.email,
          phoneNumber: normalizedCustomer.phoneNumber,
          idNumber: normalizedCustomer.idNumber,
          nextOfKin: (customer.nextOfKinName || customer.nextOfKinRelationship ||
            customer.nextOfKinPhoneNumber || customer.nextOfKinEmail)
            ? [{
              name: customer.nextOfKinName || '',
              relationship: customer.nextOfKinRelationship || '',
              phoneNumber: customer.nextOfKinPhoneNumber || '',
              email: customer.nextOfKinEmail || '',
              canReceiveInvoice: normalizedCustomer.canReceiveInvoice,
            }]
            : [],
          customerType: normalizedCustomer.customerType,
          residentType: normalizedCustomer.residentType,
          nonResidentUsage: normalizedCustomer.nonResidentUsage,
          facilityId,
          status: "Active",
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const savedCustomer = await customerData.save();

        // Store customer ID for later unit assignment
        customerIdByEmail.set(normalizedCustomer.email, savedCustomer._id);

        // Handle user creation/update (WITH FIXED ROLE)
        const existingUser = await payservedb.User.findOne({
          email: normalizedCustomer.email
        });

        if (existingUser) {
          let customerDataArray = existingUser.customerData || [];
          const facilityIndex = customerDataArray.findIndex(
            item => item.facilityId.toString() === facilityId.toString()
          );

          if (facilityIndex >= 0) {
            customerDataArray[facilityIndex].customerId = savedCustomer._id;
            customerDataArray[facilityIndex].isEnabled = true;
          } else {
            customerDataArray.push({
              facilityId,
              customerId: savedCustomer._id,
              isEnabled: true,
            });
          }

          const updateData = {
            customerData: customerDataArray,
            updatedAt: new Date()
          };

          if (normalizedCustomer.residentType === "non-resident" &&
            normalizedCustomer.customerType === "home owner") {
            updateData.type = "Landlord";
          }

          await payservedb.User.updateOne(
            { _id: existingUser._id },
            { $set: updateData }
          );
        } else {
          const password = 'PXDS' + customerNumber;
          const hashedPassword = await bcrypt.hash(password, 10);
          let userType = normalizedCustomer.residentType === "resident" ? "Resident" : "Landlord";

          const validRole = "admin";

          const newUser = new payservedb.User({
            fullName,
            email: normalizedCustomer.email,
            phoneNumber: normalizedCustomer.phoneNumber,
            idNumber: normalizedCustomer.idNumber,
            type: userType,
            role: validRole,
            kyc: {},
            companies: [],
            customerData: [{
              facilityId,
              customerId: savedCustomer._id,
              isEnabled: true,
            }],
            password: hashedPassword,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
          });

          await newUser.save();
        }

        results.successful.push({
          row: rowNumber,
          customerId: savedCustomer._id,
          customerNumber: savedCustomer.customerNumber,
          name: fullName,
          email: normalizedCustomer.email,
          unitsAssigned: processedUnits.length,
          customerType: normalizedCustomer.customerType
        });


      } catch (error) {
        console.error(`❌ ERROR processing row ${rowNumber}:`, error.message);
        console.error(error.stack);

        results.failed.push({
          row: rowNumber,
          data: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email
          },
          error: error.message
        });
      }
    }

    // Now update unit assignments with actual customer IDs
    for (let [unitId, assignment] of unitAssignments) {
      const unitName = unitIdMap.get(unitId) || unitId;

      // Update homeowner ID if we have email
      if (assignment.homeOwnerEmail && customerIdByEmail.has(assignment.homeOwnerEmail)) {
        assignment.homeOwnerId = customerIdByEmail.get(assignment.homeOwnerEmail);
      } else if (assignment.homeOwnerId === 'pending') {
        assignment.homeOwnerId = null;
      }

      // Update tenant ID if we have email
      if (assignment.tenantEmail && customerIdByEmail.has(assignment.tenantEmail)) {
        assignment.tenantId = customerIdByEmail.get(assignment.tenantEmail);
      } else if (assignment.tenantId === 'pending') {
        assignment.tenantId = null;
      }

      // Determine resident ID
      if (assignment.tenantId && assignment.tenantId !== 'pending') {
        // If there's a tenant, they are the resident
        assignment.residentId = assignment.tenantId;
      } else if (assignment.homeOwnerId && assignment.homeOwnerId !== 'pending') {
        // If no tenant but homeowner exists
        assignment.residentId = assignment.homeOwnerId;
      } else if (assignment.residentId === 'pending') {
        assignment.residentId = null;
      }

      unitAssignments.set(unitId, assignment);
    }

    // Second pass: Assign units after all customers are created

    let unitUpdateCount = 0;
    for (let [unitId, assignment] of unitAssignments) {
      const unitName = unitIdMap.get(unitId) || unitId;

      try {
        const updateData = {
          updatedAt: new Date()
        };

        let hasUpdates = false;

        // Assign homeowner if exists
        if (assignment.homeOwnerId && assignment.homeOwnerId !== 'pending') {
          updateData.homeOwnerId = assignment.homeOwnerId;
          hasUpdates = true;
        } else {
          console.log(`   No valid homeOwnerId (current: ${assignment.homeOwnerId})`);
        }

        // Assign tenant if exists
        if (assignment.tenantId && assignment.tenantId !== 'pending') {
          updateData.tenantId = assignment.tenantId;
          hasUpdates = true;
        } else {
          console.log(`   No valid tenantId (current: ${assignment.tenantId})`);
        }

        // Assign resident
        if (assignment.residentId && assignment.residentId !== 'pending') {
          updateData.residentId = assignment.residentId;
          hasUpdates = true;
        } else {
          console.log(`   No valid residentId (current: ${assignment.residentId})`);
        }

        // Also update occupants array
        const occupantsUpdate = [];
        if (assignment.homeOwnerId && assignment.homeOwnerId !== 'pending') {
          occupantsUpdate.push({
            customerId: assignment.homeOwnerId,
            customerType: 'home owner',
            moveInDate: new Date(),
            moveOutDate: null
          });
        }
        if (assignment.tenantId && assignment.tenantId !== 'pending') {
          occupantsUpdate.push({
            customerId: assignment.tenantId,
            customerType: 'tenant',
            moveInDate: new Date(),
            moveOutDate: null
          });
        }

        if (occupantsUpdate.length > 0) {
          updateData.occupants = occupantsUpdate;
          hasUpdates = true;
        }

        // Only update if there are actual assignments
        if (hasUpdates) {
          try {
            const result = await unitModel.findByIdAndUpdate(
              unitId,
              { $set: updateData },
              { new: true }
            );
            unitUpdateCount++;
          } catch (updateError) {
            console.error(`   ❌ Failed to update unit ${unitName}:`, updateError.message);
          }
        } else {
          console.log(`   ⏭️ Skipping unit update - no assignments to make`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to update unit ${unitId}:`, error.message);
        console.error(error.stack);
      }
    }

    // Third pass: Create handovers
    const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
    let handoverCount = 0;

    for (let result of results.successful) {

      const customerType = result.customerType;
      // Get resident type from original customer data
      const originalCustomer = customers.find(c => c.email.toLowerCase() === result.email);
      const residentType = originalCustomer ? (originalCustomer.residentType || 'resident').toLowerCase() : 'resident';

      // Get assigned units for this customer
      const assignedUnits = [];
      for (let [unitId, assignment] of unitAssignments) {
        if ((assignment.homeOwnerId && assignment.homeOwnerId.toString() === result.customerId.toString()) ||
          (assignment.tenantId && assignment.tenantId.toString() === result.customerId.toString())) {
          const unitData = Array.from(unitNameMap.values()).find(u => u._id.toString() === unitId);
          if (unitData) {
            assignedUnits.push(unitData);
          }
        }
      }

      // Create handovers for eligible customers
      const shouldCreateHandover = (
        customerType === 'tenant' ||
        (customerType === 'home owner' && residentType === 'resident')
      );

      if (shouldCreateHandover && assignedUnits.length > 0) {

        for (let unit of assignedUnits) {
          try {
            const existingHandover = await handoverModel.findOne({
              unitId: unit._id,
              customerId: result.customerId,
              handoverType: 'MoveIn'
            });

            if (!existingHandover) {
              await handoverModel.create({
                facilityId,
                unitId: unit._id,
                customerId: result.customerId,
                handoverType: 'MoveIn',
                handoverDate: new Date(),
                items: [],
                meterReadings: {
                  electricity: { reading: 0, unit: 'kWh' },
                  water: { reading: 0, unit: 'm³' },
                  gas: { reading: 0, unit: 'm³' }
                },
                keysHandedOver: 0,
                notes: `Auto-created during import for ${customerType} ${result.name}`,
                attachments: [],
                signatures: {
                  propertyManager: {},
                  customer: { agreement: false }
                },
                status: 'Draft',
                createdAt: new Date(),
                updatedAt: new Date()
              });
              handoverCount++;
            } else {
              console.log(`   ⏭️ Handover already exists for unit ${unit.name}`);
            }
          } catch (handoverError) {
            console.error(`   ❌ Handover creation failed for unit ${unit._id}:`, handoverError.message);
            console.error(handoverError.stack);
          }
        }
      } else {
        console.log(`   ⏭️ Skipping handover creation - not eligible or no units`);
      }
    }

    const summary = {
      total: customers.length,
      successful: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    };

    return reply.code(200).send({
      success: true,
      message: `Import completed: ${summary.successful} successful, ${summary.failed} failed, ${summary.skipped} skipped`,
      summary,  // Direct properties
      results
    });

  } catch (err) {
    console.error('❌ GLOBAL IMPORT ERROR:', err.message);
    console.error(err.stack);

    return reply.code(500).send({
      success: false,
      error: err.message,
      message: 'Internal server error during import'
    });
  }
};

module.exports = import_customers;
