const payservedb = require("payservedb");

const get_company_data = async (request, reply) => {
  try {
    // Fetch the company data - using the correct model name (Company, not Companies)
    const company = await payservedb.Company.findOne({ isEnabled: true });

    if (!company) {
      return reply.code(404).send({
        success: false,
        error: "Company data not found",
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
    console.error("Error fetching company data:", err);
    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = get_company_data;
