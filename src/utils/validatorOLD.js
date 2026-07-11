const Joi = require('joi');

const loginValidator = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email address.',
        'any.required': 'Email address is required.'
    }),
    password: Joi.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters long.',
        'any.required': 'Password is required.'
    }),
    
});
const loginValidator2 = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email address.',
        'any.required': 'Email address is required.'
    }),
    password: Joi.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters long.',
        'any.required': 'Password is required.'
    }),
    platform: Joi.string().required(),
});


const forgotPasswordValidator = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email address.',
        'any.required': 'Email address is required.'
    }),
});

const resetPasswordValidator = Joi.object({
    password: Joi.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters long.',
        'any.required': 'Password is required.'
    }),
    confirm_password: Joi.string().min(8).required().valid(Joi.ref('password')).messages({
        'string.min': 'Confirm Password must be at least 8 characters long.',
        'any.required': 'Confirm Password is required.',
        'any.only': 'Confirm Password must match Password.'
    })
});

const addConcentratorValidator = Joi.object({
    serialNumber: Joi.number().required(),
    manufacturer: Joi.string().required(),
    range: Joi.number().required()
});

const addPowerGatewayValidator = Joi.object({
    serialNumber: Joi.number().required(),
    manufacturer: Joi.string().required(),
});
const updateConcentratorValidator = Joi.object({
    serialNumber: Joi.number().required(),
    manufacturer: Joi.string().required(),
    range: Joi.number().required()
});
const updateGatewayValidator = Joi.object({
    serialNumber: Joi.number().required(),
    manufacturer: Joi.string().required(),
});
const updateWaterMeterValidator = Joi.object({
    serialNumber: Joi.number().required(),
    manufacturer: Joi.string().required(),
    size: Joi.string().required(),
    initialValue: Joi.number().required(),
});
const updatePowerMeterValidator = Joi.object({
    serialNumber: Joi.number().required(),
    manufacturer: Joi.string().required(),
    size: Joi.string().required(),
    protocal: Joi.string().required(),
    initialValue: Joi.number().required(),
    currentValue: Joi.number().required(),
});
const geolocationValidator = Joi.object({
    lat: Joi.number().required(),
    long: Joi.string().required(),
});
const inStockValidator = Joi.object({
    inStock: Joi.boolean().required(),
});
const isFaultyValidator = Joi.object({
    isFaulty: Joi.boolean().required(),
});
const isInstalledValidator = Joi.object({
    isFaulty: Joi.boolean().required(),
});
const companyValidator = Joi.object({
    userType: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().required(),
    phoneNumber: Joi.string().required(),
    idNumber: Joi.string().required(),
    facilityName: Joi.string().required(),
    facilityLocation: Joi.string().required(),
    subDivision: Joi.string().required(),
    divisionArray: Joi.array().required(),
    companyName: Joi.string(),
    companyAddress: Joi.string(),
    companyCountry: Joi.string(),
    companyEmail: Joi.string(),
    companyCity:Joi.string(),
    companyTaxNumber:Joi.string(),
    companyRegistrationNumber:Joi.string()
});
const siteValidator = Joi.object({
    name: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
});
const AddCompanyUser = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required().messages({
        'string.email': 'Please enter a valid email address.',
        'any.required': 'Email address is required.'
    }),
    password: Joi.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters long.',
        'any.required': 'Password is required.'
    })
});
module.exports = {
    loginValidator,
    loginValidator2,
    forgotPasswordValidator,
    resetPasswordValidator,
    addConcentratorValidator,
    updateConcentratorValidator,
    updateWaterMeterValidator,
    geolocationValidator,
    addPowerGatewayValidator,
    updateGatewayValidator,
    inStockValidator,
    isFaultyValidator,
    isInstalledValidator,
    updatePowerMeterValidator,
    companyValidator,
    AddCompanyUser,
    siteValidator

}