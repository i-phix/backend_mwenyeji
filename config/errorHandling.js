const logger = require('./winston')
const errorHandling = ()=>{
    process.on('uncaughtException', (error, request) => {
        console.log(error)
        logger.error(`Uncaught ${error}`)
        setTimeout(() => {
           process.exit();
        }, 500);
    });
    
    process.on('unhandledRejection', (reason, promise, request) => {
        logger.error(`Unhandled Rejection at  reason: ${reason}`);
        setTimeout(() => {
            process.exit();
         }, 500);
    });
}
module.exports = errorHandling