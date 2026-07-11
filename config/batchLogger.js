// batchLogger.js
const payservedb = require('payservedb');
const logger = require('./winston');
const BATCH_SIZE = 2; // Number of logs to collect before writing to the database
const BATCH_INTERVAL = 5000; // Time interval (in ms) to write logs if batch size is not reached

let logBuffer = [];

const addLog = (log) => {
    logBuffer.push(log);
    if (logBuffer.length >= BATCH_SIZE) {
        flushLogs();
    }
};

const flushLogs = async () => {
    if (logBuffer.length > BATCH_SIZE) {
        const logsToWrite = logBuffer;
        logBuffer = [];
        try {

            const results = await payservedb.ApiLog.insertMany(logsToWrite);
            console.log('Logs written to database');
            logger.info(`Logs written to database: ${results.length}`)
        } catch (err) {
            console.error('Error writing logs to database', err);
            logger.error('Error writing logs to database', err)
        }
    }
};

// Periodically flush logs even if the batch size is not reached
setInterval(flushLogs, BATCH_INTERVAL);

module.exports = { addLog };