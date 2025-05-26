"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedLoggerService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path = require("path");
let EnhancedLoggerService = class EnhancedLoggerService {
    constructor(context) {
        this.logDir = path.join(process.cwd(), 'logs');
        this.context = context;
        const date = new Date().toISOString().split('T')[0];
        this.logFile = path.join(this.logDir, `app-${date}.log`);
        this.ensureLogDir();
    }
    async ensureLogDir() {
        try {
            await fs_1.promises.mkdir(this.logDir, { recursive: true });
        }
        catch (error) {
            console.error(`Erreur lors de la création du répertoire de logs: ${error.message}`);
        }
    }
    async writeToFile(message) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `${timestamp} ${message}\n`;
            await fs_1.promises.appendFile(this.logFile, logEntry);
        }
        catch (error) {
            console.error(`Erreur lors de l'écriture dans le fichier de log: ${error.message}`);
        }
    }
    formatMessage(message, context) {
        const ctx = context || this.context;
        const contextStr = ctx ? `[${ctx}] ` : '';
        if (typeof message === 'object') {
            return `${contextStr}${JSON.stringify(message, null, 2)}`;
        }
        return `${contextStr}${message}`;
    }
    log(message, context) {
        const formattedMessage = this.formatMessage(message, context);
        console.log(formattedMessage);
        this.writeToFile(`INFO: ${formattedMessage}`);
    }
    error(message, trace, context) {
        const formattedMessage = this.formatMessage(message, context);
        console.error(formattedMessage);
        let logMessage = `ERROR: ${formattedMessage}`;
        if (trace) {
            logMessage += `\nStack: ${trace}`;
        }
        this.writeToFile(logMessage);
    }
    warn(message, context) {
        const formattedMessage = this.formatMessage(message, context);
        console.warn(formattedMessage);
        this.writeToFile(`WARN: ${formattedMessage}`);
    }
    debug(message, context) {
        const formattedMessage = this.formatMessage(message, context);
        console.debug(formattedMessage);
        this.writeToFile(`DEBUG: ${formattedMessage}`);
    }
    verbose(message, context) {
        const formattedMessage = this.formatMessage(message, context);
        console.log(formattedMessage);
        this.writeToFile(`VERBOSE: ${formattedMessage}`);
    }
};
exports.EnhancedLoggerService = EnhancedLoggerService;
exports.EnhancedLoggerService = EnhancedLoggerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [String])
], EnhancedLoggerService);
//# sourceMappingURL=logger.service.js.map