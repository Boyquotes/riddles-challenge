"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const dotenv = require("dotenv");
const logger_service_1 = require("./common/logger.service");
const fs = require("fs");
const path = require("path");
dotenv.config();
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
async function bootstrap() {
    const logger = new logger_service_1.EnhancedLoggerService('Bootstrap');
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule, {
            cors: true,
            logger: logger
        });
        await app.listen(3001);
        logger.log(`Application is running on: ${await app.getUrl()}`);
    }
    catch (error) {
        logger.error(`Failed to start application: ${error.message}`, error.stack);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map