const multer = require('fastify-multer');
const path = require('path');

// Set up storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.resolve(__dirname, '../../uploads'); // Resolve the directory path
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Use a unique filename
    }
});

// Create the multer instance
const upload = multer({ storage: storage });

// Export the upload middleware
module.exports = upload;
