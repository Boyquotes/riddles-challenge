import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { EnhancedLoggerService } from './common/logger.service';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Créer le répertoire de logs s'il n'existe pas
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

async function bootstrap() {
  // Créer un logger personnalisé
  const logger = new EnhancedLoggerService('Bootstrap');
  
  try {
    // Utiliser notre logger personnalisé lors de la création de l'application
    const app = await NestFactory.create(AppModule, {
      cors: true,
      logger: logger
    });
    
    await app.listen(3001);
    logger.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
