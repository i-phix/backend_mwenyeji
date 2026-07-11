const payservedb = require("payservedb");

const get_company_by_facility = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    // Find company that contains this facility - using correct model name
    const company = await payservedb.Company.findOne({
      facilities: facilityId,
      isEnabled: true,
    });

    if (!company) {
      return reply.code(404).send({
        success: false,
        error: "Company not found for this facility",
      });
    }

    // Return company data directly - it will be used for "Bill To" section
    const companyData = {
      _id: company._id,
      name: company.name,
      address: company.address,
      city: company.city,
      country: company.country,
      email: company.email,
      registrationNumber: company.registrationNumber,
      taxNumber: company.companyTaxNumber,
      pinNumber: company.companyPinNumber,
      logo: company.logo,
      logoPreview: company.logo ? `/${company.logo}` : null,
      isEnabled: company.isEnabled,
      facilities: company.facilities,
      fullAddress: company.address
        ? `${company.address}\n${company.city}, ${company.country}`
        : `${company.city}, ${company.country}`,
    };

    return reply.code(200).send({
      success: true,
      data: companyData,
    });
  } catch (err) {
    console.error("Error fetching company by facility:", err);
    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = get_company_by_facility;
