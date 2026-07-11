const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

const upload_profile_image = async (request, reply) => {
    try {
        const agent = request.user;

        console.log('=== Upload Profile Image ===');
        console.log('User ID:', agent.userId);

        // Find the agent by user_id
        const agentData = await payservedb.Agent.findOne({ user_id: agent.userId });

        if (!agentData) {
            return reply.code(404).send({
                success: false,
                error: 'Agent not found'
            });
        }

        // Get the uploaded file from fastify multipart
        const data = await request.file();

        if (!data) {
            return reply.code(400).send({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Validate file type
        if (!data.mimetype.startsWith('image/')) {
            return reply.code(400).send({
                success: false,
                error: 'Only image files are allowed'
            });
        }

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../../../../uploads/profile_images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(data.filename);
        const filename = 'agent-' + uniqueSuffix + ext;
        const filepath = path.join(uploadDir, filename);

        // Save file to disk
        await pipeline(data.file, fs.createWriteStream(filepath));

        // Check file size (2MB limit)
        const stats = fs.statSync(filepath);
        if (stats.size > 2 * 1024 * 1024) {
            fs.unlinkSync(filepath); // Delete the file
            return reply.code(400).send({
                success: false,
                error: 'File size exceeds 2MB limit'
            });
        }

        // Delete old profile image if exists
        if (agentData.profile_image) {
            const oldImagePath = path.join(__dirname, '../../../../uploads/profile_images', path.basename(agentData.profile_image));
            if (fs.existsSync(oldImagePath)) {
                try {
                    fs.unlinkSync(oldImagePath);
                } catch (err) {
                    console.log('Could not delete old image:', err.message);
                }
            }
        }

        // Save the file path to database
        const imageUrl = `/uploads/profile_images/${filename}`;
        agentData.profile_image = imageUrl;
        agentData.updated_at = new Date();
        await agentData.save();

        logger.info(`Profile image updated for agent ${agentData.agent_id}`);

        return reply.code(200).send({
            success: true,
            message: 'Profile image uploaded successfully',
            data: {
                profile_image: imageUrl
            }
        });

    } catch (error) {
        console.error('Upload profile image error:', error);
        logger.error(`Error uploading profile image: ${error.message}`, { stack: error.stack });

        return reply.code(500).send({
            success: false,
            error: 'Failed to upload profile image'
        });
    }
};

module.exports = upload_profile_image;
