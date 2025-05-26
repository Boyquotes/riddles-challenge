import { LoggerService } from '@nestjs/common';
export declare class EnhancedLoggerService implements LoggerService {
    private readonly logDir;
    private readonly logFile;
    private readonly context?;
    constructor(context?: string);
    private ensureLogDir;
    private writeToFile;
    private formatMessage;
    log(message: any, context?: string): void;
    error(message: any, trace?: string, context?: string): void;
    warn(message: any, context?: string): void;
    debug(message: any, context?: string): void;
    verbose(message: any, context?: string): void;
}
