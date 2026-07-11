/**
 * Encryption Utility
 *
 * Provides functions to encrypt and decrypt sensitive data
 * Uses AES-256-CBC encryption algorithm
 *
 * Environment Variables Required:
 * - ENCRYPTION_KEY: 64-character hex string (32 bytes)
 *
 * To generate a key:
 * node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require('crypto');

// Encryption algorithm
const ALGORITHM = 'aes-256-cbc';

// Get encryption key from environment variable
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn('⚠️  ENCRYPTION_KEY not set in environment variables. Using default key (NOT SECURE for production)');
    // Default key for development only - MUST be replaced in production
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  return Buffer.from(key, 'hex');
};

/**
 * Encrypt a string
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:encryptedData
 */
function encrypt(text) {
  try {
    if (!text) {
      return null;
    }

    if (typeof text !== 'string') {
      text = String(text);
    }

    const key = getEncryptionKey();

    // Generate random initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV and encrypted data separated by colon
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted text in format: iv:encryptedData
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
  try {
    if (!encryptedText) {
      return null;
    }

    if (typeof encryptedText !== 'string') {
      throw new Error('Encrypted text must be a string');
    }

    const key = getEncryptionKey();

    // Split IV and encrypted data
    const parts = encryptedText.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Decrypt the text
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a string using SHA-256
 * Useful for one-way hashing (e.g., verification tokens)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text
 */
function hash(text) {
  try {
    if (!text) {
      return null;
    }

    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  } catch (error) {
    console.error('Hashing error:', error.message);
    throw new Error('Failed to hash data');
  }
}

/**
 * Mask a string for display purposes
 * Shows only first 4 and last 4 characters
 * @param {string} text - Text to mask
 * @param {number} visibleChars - Number of visible characters at start and end (default: 4)
 * @returns {string} - Masked text
 */
function mask(text, visibleChars = 4) {
  try {
    if (!text) {
      return null;
    }

    if (typeof text !== 'string') {
      text = String(text);
    }

    if (text.length <= visibleChars * 2) {
      return '••••••••';
    }

    const start = text.substring(0, visibleChars);
    const end = text.substring(text.length - visibleChars);

    return start + '••••••••' + end;
  } catch (error) {
    console.error('Masking error:', error.message);
    return '••••••••';
  }
}

/**
 * Generate a random token
 * @param {number} length - Length of token in bytes (default: 32)
 * @returns {string} - Random hex token
 */
function generateToken(length = 32) {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    console.error('Token generation error:', error.message);
    throw new Error('Failed to generate token');
  }
}

/**
 * Compare two strings securely (constant-time comparison)
 * Prevents timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings match
 */
function secureCompare(a, b) {
  try {
    if (!a || !b) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    return false;
  }
}

/**
 * Validate encryption key format
 * @returns {Object} - Validation result with isValid and message
 */
function validateEncryptionKey() {
  try {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      return {
        isValid: false,
        message: 'ENCRYPTION_KEY not set in environment variables'
      };
    }

    if (key.length !== 64) {
      return {
        isValid: false,
        message: 'ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex)'
      };
    }

    // Try to parse as hex
    try {
      Buffer.from(key, 'hex');
    } catch (e) {
      return {
        isValid: false,
        message: 'ENCRYPTION_KEY must be a valid hexadecimal string'
      };
    }

    return {
      isValid: true,
      message: 'Encryption key is valid'
    };
  } catch (error) {
    return {
      isValid: false,
      message: 'Error validating encryption key'
    };
  }
}

module.exports = {
  encrypt,
  decrypt,
  hash,
  mask,
  generateToken,
  secureCompare,
  validateEncryptionKey
};
