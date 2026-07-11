const bcrypt = require('bcryptjs');
const db = require('payservedb');

async function seedMoveInAdmin() {
    const password = process.env.MOVEIN_ADMIN_PASSWORD || 'Admin12345!';
    const email = process.env.MOVEIN_ADMIN_EMAIL || 'dev.admin@payserve.local';
    const phoneNumber = process.env.MOVEIN_ADMIN_PHONE || '0700000000';

    await db.connectToMongoDB(
        process.env.MAIN_DB_NAME || 'payserve_property',
        process.env.MONGODB_SECURED === 'false' ? false : true,
        process.env.MONGODB_USER || 'Ps',
        process.env.MONGODB_PASSWORD || 'Letmein987',
        process.env.MONGODB_HOST || '127.0.0.1',
        process.env.MONGODB_PORT || '27017'
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.User.findOneAndUpdate(
        { email },
        {
            $set: {
                fullName: 'Local Move-In Admin',
                email,
                phoneNumber,
                type: 'Universal',
                role: 'admin',
                password: hashedPassword,
                isEnabled: true,
            },
        },
        { upsert: true, new: true }
    ).select('email phoneNumber type role');

    console.log('Move-In admin ready:');
    console.log(`Username: ${user.email}`);
    console.log(`Password: ${password}`);
}

seedMoveInAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
