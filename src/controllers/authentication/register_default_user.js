const bcrypt = require('bcryptjs')
const db = require('payservedb')
const register_default_user = async () => {
    try {
        const fullName = "Payserve Dev";
        const email = "devs@payserve.co.ke";
        const phoneNumber = "799010210";
        const type = "Universal";
        const role = "admin";
        const companies = [];
        const password = "Letmein987!";
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const userExist = await db.User.findOne({ email: email });
        if (!userExist) {
            setTimeout(async()=>{
                let data = new db.User({
                    fullName: fullName,
                    email: email,
                    phoneNumber: phoneNumber,
                    type: type,
                    role: role,
                    companies: companies,
                    password: hashedPassword
                })
                await data.save();
            },5000)
         
        }

    }
    catch (err) {
        console.log(err)
    }
}
module.exports = register_default_user