const fs = require('fs');
const path = require('path');
function apiLog(message) {
    const logFilePath = path.join(__dirname, '../logs/apis.txt'); // Adjust the path as necessary
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.log('Failed to write log:', err);
        }
    });
}
module.exports = apiLog