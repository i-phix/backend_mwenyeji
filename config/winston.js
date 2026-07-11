const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

const myFormat = printf((info) => {
    const { level, message, timestamp} = info;
    return `${timestamp} ${level} - Message: ${message}`;
});

const logger = winston.createLogger({
    level: 'debug',
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/access.log' ,level:'info'}),
        new winston.transports.File({ filename: 'logs/error.log' ,level:'error'}),
        new winston.transports.File({ filename: 'logs/warn.log' ,level:'warn'}),
    ],
});

module.exports = logger
