module.exports = {
  imap: {
    user: process.env.CO_EMAIL_USER || 'support@payserve.co.ke',
    password: process.env.CO_EMAIL_PASSWORD || '',
    host: process.env.CO_EMAIL_IMAP_HOST || 'imap.zoho.com',
    port: Number(process.env.CO_EMAIL_IMAP_PORT || 993),
    tls: String(process.env.CO_EMAIL_IMAP_TLS || 'true').toLowerCase() === 'true',
    tlsOptions: { rejectUnauthorized: false }
  },
  smtp: {
    host: process.env.CO_EMAIL_SMTP_HOST || 'smtp.zoho.com',
    port: Number(process.env.CO_EMAIL_SMTP_PORT || 465),
    secure: String(process.env.CO_EMAIL_SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.CO_EMAIL_USER || 'support@payserve.co.ke',
      pass: process.env.CO_EMAIL_PASSWORD || ''
    }
  }
};
