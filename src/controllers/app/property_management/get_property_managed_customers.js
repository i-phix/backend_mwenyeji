const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_property_managed_customers = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { customerType, page = 1, limit = 10 } = request.query;

    console.log('Starting property managed customers fetch for facility:', facilityId);

    // Get the tenant-specific Unit model
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // STEP 1: First, get all units that are managed by property manager
    const propertyManagedUnits = await unitModel.find({ 
      facilityId,
      isManagedByPropertyManager: true 
    }).select('_id name unitType division tenantId homeOwnerId propertyManagementFee status')
    .lean();

    console.log('Property managed units found:', {
      totalUnits: propertyManagedUnits.length,
      sampleUnit: propertyManagedUnits[0]
    });

    if (propertyManagedUnits.length === 0) {
      return reply.code(200).send({ 
        success: true,
        message: "No property managed units found",
        customers: [], 
        totalCustomers: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        propertyManagedUnitsCount: 0,
        summary: {
          totalLandlords: 0,
          totalTenants: 0,
          totalCustomers: 0,
          occupiedUnits: 0,
          unoccupiedUnits: 0
        }
      });
    }

    // STEP 2: Now get the unit information with customer details populated
    // This follows the exact pattern from your working endpoints
    const unitsWithCustomers = await unitModel.find({ 
      _id: { $in: propertyManagedUnits.map(unit => unit._id) },
      isManagedByPropertyManager: true // Double check this condition
    })
    .populate({
      path: 'tenantId',
      model: payservedb.Customer,
      select: 'customerNumber firstName lastName phoneNumber email customerType residentType status nextOfKinName nextOfKinRelationship nextOfKinContact createdAt updatedAt'
    })
    .populate({
      path: 'homeOwnerId', 
      model: payservedb.Customer,
      select: 'customerNumber firstName lastName phoneNumber email customerType residentType status nextOfKinName nextOfKinRelationship nextOfKinContact createdAt updatedAt'
    })
    .lean();

    console.log('Units with customer data populated:', {
      unitsFound: unitsWithCustomers.length,
      sampleUnitWithCustomer: unitsWithCustomers[0]
    });

    // STEP 3: Extract customers from the populated units
    const allCustomers = [];
    const customerMap = new Map();

    unitsWithCustomers.forEach(unit => {
      console.log('Processing unit:', {
        unitName: unit.name,
        hasTenant: !!unit.tenantId,
        hasHomeOwner: !!unit.homeOwnerId,
        tenantData: unit.tenantId ? {
          id: unit.tenantId._id,
          name: `${unit.tenantId.firstName} ${unit.tenantId.lastName}`,
          type: unit.tenantId.customerType
        } : null,
        homeOwnerData: unit.homeOwnerId ? {
          id: unit.homeOwnerId._id,
          name: `${unit.homeOwnerId.firstName} ${unit.homeOwnerId.lastName}`,
          type: unit.homeOwnerId.customerType
        } : null
      });

      // Add tenant if exists and is populated
      if (unit.tenantId && unit.tenantId._id) {
        const tenant = unit.tenantId;
        const tenantKey = tenant._id.toString();
        
        if (!customerMap.has(tenantKey)) {
          customerMap.set(tenantKey, {
            ...tenant,
            _id: tenant._id,
            fullName: `${tenant.firstName} ${tenant.lastName}`,
            role: tenant.customerType === 'home owner' ? 'Landlord' : 'Tenant',
            unitsManaged: [],
            unitsCount: 0,
            ownedUnitsCount: 0,
            rentedUnitsCount: 0
          });
        }
        
        // Add unit info to customer
        const customerData = customerMap.get(tenantKey);
        customerData.unitsManaged.push({
          unitId: unit._id,
          unitName: unit.name,
          unitType: unit.unitType,
          division: unit.division,
          propertyManagementFee: unit.propertyManagementFee,
          relationship: 'tenant',
          unitStatus: unit.status
        });
        customerData.unitsCount++;
        customerData.rentedUnitsCount++;
      }

      // Add homeOwner if exists and is populated
      if (unit.homeOwnerId && unit.homeOwnerId._id) {
        const homeOwner = unit.homeOwnerId;
        const homeOwnerKey = homeOwner._id.toString();
        
        if (!customerMap.has(homeOwnerKey)) {
          customerMap.set(homeOwnerKey, {
            ...homeOwner,
            _id: homeOwner._id,
            fullName: `${homeOwner.firstName} ${homeOwner.lastName}`,
            role: homeOwner.customerType === 'home owner' ? 'Landlord' : 'Tenant',
            unitsManaged: [],
            unitsCount: 0,
            ownedUnitsCount: 0,
            rentedUnitsCount: 0
          });
        }
        
        // Add unit info to customer
        const customerData = customerMap.get(homeOwnerKey);
        customerData.unitsManaged.push({
          unitId: unit._id,
          unitName: unit.name,
          unitType: unit.unitType,
          division: unit.division,
          propertyManagementFee: unit.propertyManagementFee,
          relationship: 'homeowner',
          unitStatus: unit.status
        });
        customerData.unitsCount++;
        customerData.ownedUnitsCount++;
      }
    });

    // Convert map to array
    const customersArray = Array.from(customerMap.values());

    console.log('Customers extracted:', {
      totalCustomersFound: customersArray.length,
      sampleCustomer: customersArray[0]
    });

    // Apply customer type filter if provided
    let filteredCustomers = customersArray;
    if (customerType) {
      filteredCustomers = customersArray.filter(customer => customer.customerType === customerType);
      console.log(`Filtered by type '${customerType}':`, filteredCustomers.length);
    }

    // Sort customers by name
    filteredCustomers.sort((a, b) => a.fullName.localeCompare(b.fullName));

    // Calculate pagination
    const totalCustomers = filteredCustomers.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalPages = Math.ceil(totalCustomers / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    // Apply pagination
    const paginatedCustomers = filteredCustomers.slice(skip, skip + parseInt(limit));

    // Separate customers by type for summary
    const landlords = customersArray.filter(customer => customer.customerType === 'home owner');
    const tenants = customersArray.filter(customer => customer.customerType === 'tenant');

    // Calculate summary statistics
    const occupiedUnits = propertyManagedUnits.filter(unit => unit.homeOwnerId || unit.tenantId).length;
    const unoccupiedUnits = propertyManagedUnits.length - occupiedUnits;

    console.log('Final summary:', {
      propertyManagedUnitsCount: propertyManagedUnits.length,
      totalCustomers: customersArray.length,
      landlords: landlords.length,
      tenants: tenants.length,
      occupiedUnits,
      unoccupiedUnits,
      paginatedCustomersCount: paginatedCustomers.length
    });

    return reply.code(200).send({
      success: true,
      message: "Property managed customers retrieved successfully",
      customers: paginatedCustomers,
      totalCustomers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext,
        hasPrev
      },
      propertyManagedUnitsCount: propertyManagedUnits.length,
      summary: {
        totalLandlords: landlords.length,
        totalTenants: tenants.length,
        totalCustomers: customersArray.length,
        occupiedUnits,
        unoccupiedUnits
      },
      filters: {
        customerType
      }
    });

  } catch (err) {
    console.error('Error in get_property_managed_customers:', err);
    return reply.code(502).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = get_property_managed_customers;