import { Injectable, LoggerService } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Service de journalisation amélioré
 * Écrit les logs à la fois dans la console et dans un fichier
 */
@Injectable()
export class EnhancedLoggerService implements LoggerService {
  private readonly logDir = path.join(process.cwd(), 'logs');
  private readonly logFile: string;
  private readonly context?: string;

  constructor(context?: string) {
    this.context = context;
    const date = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    this.logFile = path.join(this.logDir, `app-${date}.log`);
    
    // Créer le répertoire de logs s'il n'existe pas
    this.ensureLogDir();
  }

  private async ensureLogDir() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error(`Erreur lors de la création du répertoire de logs: ${error.message}`);
    }
  }

  private async writeToFile(message: string) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} ${message}\n`;
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error(`Erreur lors de l'écriture dans le fichier de log: ${error.message}`);
    }
  }

  private formatMessage(message: any, context?: string): string {
    const ctx = context || this.context;
    const contextStr = ctx ? `[${ctx}] ` : '';
    
    if (typeof message === 'object') {
      return `${contextStr}${JSON.stringify(message, null, 2)}`;
    }
    
    return `${contextStr}${message}`;
  }

  log(message: any, context?: string) {
    const formattedMessage = this.formatMessage(message, context);
    console.log(formattedMessage);
    this.writeToFile(`INFO: ${formattedMessage}`);
  }

  error(message: any, trace?: string, context?: string) {
    const formattedMessage = this.formatMessage(message, context);
    console.error(formattedMessage);
    
    let logMessage = `ERROR: ${formattedMessage}`;
    if (trace) {
      logMessage += `\nStack: ${trace}`;
    }
    
    this.writeToFile(logMessage);
  }

  warn(message: any, context?: string) {
    const formattedMessage = this.formatMessage(message, context);
    console.warn(formattedMessage);
    this.writeToFile(`WARN: ${formattedMessage}`);
  }

  debug(message: any, context?: string) {
    const formattedMessage = this.formatMessage(message, context);
    console.debug(formattedMessage);
    this.writeToFile(`DEBUG: ${formattedMessage}`);
  }

  verbose(message: any, context?: string) {
    const formattedMessage = this.formatMessage(message, context);
    console.log(formattedMessage);
    this.writeToFile(`VERBOSE: ${formattedMessage}`);
  }
}
