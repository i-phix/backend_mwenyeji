// const multer = require('fastify-multer');
// const path = require('path');
// const fs = require('fs');

// // Ensure uploads directory exists
// const uploadPath = path.resolve(__dirname, '../../uploads');
// if (!fs.existsSync(uploadPath)) {
//     fs.mkdirSync(uploadPath, { recursive: true });
// }

// // Configure storage
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, uploadPath);
//     },
//     filename: (req, file, cb) => {
//         // Create unique filename with original extension
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, uniqueSuffix + path.extname(file.originalname));
//     }
// });

// // File filter function
// const fileFilter = (req, file, cb) => {
//     const allowedTypes = ['text/csv',
//         'application/vnd.ms-excel', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

//     if (allowedTypes.includes(file.mimetype)) {
//         cb(null, true);
//     } else {
//         cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
//     }
// };

// // Create multer instance
// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 10 * 1024 * 1024 // 10MB limit
//     }
// });

// module.exports = upload;

const multer = require('fastify-multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadPath = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter function - UPDATED FOR IMAGES
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/csv',
        'application/vnd.ms-excel', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
};

// Create multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

module.exports = upload;