const crypto = require('crypto');
const mongoose = require('mongoose');

// Define a schema for the short URLs
const ShortUrlSchema = new mongoose.Schema({
  original: {
    type: String,
    required: true,
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 31536000, // URLs expire after 1 year (in seconds)
  },
  clicks: {
    type: Number,
    default: 0,
  }
});

// Optional: create model only if it doesn't exist to avoid model overwrite warnings
const ShortUrl = mongoose.models.ShortUrl || mongoose.model('ShortUrl', ShortUrlSchema);

/**
 * Generates a short code for a URL
 * @returns {String} - A random 6-character string
 */
const generateShortCode = () => {
  return crypto.randomBytes(3).toString('hex'); // 6 characters
};

/**
 * Creates a shortened URL and stores it in the database
 * @param {String} originalUrl - The original URL to shorten
 * @returns {Promise<String>} - The short code for the URL
 */
const createShortUrl = async (originalUrl) => {
  try {
    // Check if URL already has a shortcode
    const existingUrl = await ShortUrl.findOne({ original: originalUrl });
    if (existingUrl) {
      return existingUrl.shortCode;
    }
    
    // Generate a unique short code
    let shortCode;
    let isUnique = false;
    
    while (!isUnique) {
      shortCode = generateShortCode();
      const existingCode = await ShortUrl.findOne({ shortCode });
      if (!existingCode) {
        isUnique = true;
      }
    }
    
    // Create a new short URL
    const shortUrl = new ShortUrl({
      original: originalUrl,
      shortCode,
    });
    
    await shortUrl.save();
    return shortCode;
  } catch (error) {
    console.error('Error creating short URL:', error);
    throw error;
  }
};

/**
 * Resolves a short code to its original URL
 * @param {String} shortCode - The short code to resolve
 * @returns {Promise<String>} - The original URL
 */
const resolveShortUrl = async (shortCode) => {
  try {
    const shortUrl = await ShortUrl.findOneAndUpdate(
      { shortCode },
      { $inc: { clicks: 1 } },
      { new: true }
    );
    
    if (!shortUrl) {
      throw new Error('Short URL not found');
    }
    
    return shortUrl.original;
  } catch (error) {
    console.error('Error resolving short URL:', error);
    throw error;
  }
};

module.exports = {
  createShortUrl,
  resolveShortUrl,
  ShortUrl
};