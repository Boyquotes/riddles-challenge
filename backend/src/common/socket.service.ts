import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { Riddle } from '../riddles/models/riddle.model';

@Injectable()
export class SocketService {
  private socketServer: Server;

  setSocketServer(server: Server) {
    this.socketServer = server;
  }

  getSocketServer(): Server {
    return this.socketServer;
  }

  /**
   * Émet un événement d'erreur blockchain à tous les clients connectés
   * @param error Message d'erreur à afficher
   */
  emitBlockchainError(error: string) {
    console.log('Emission de l\'erreur blockchain:', error);
    if (this.socketServer) {
      console.log('Socket server trouvé, émission de l\'erreur blockchain...');
      this.socketServer.emit('blockchainErrorNotification', { error });
    }
  }
  
  /**
   * Émet un événement de succès blockchain à tous les clients connectés
   * @param message Message de succès à afficher
   */
  emitBlockchainSuccess(message: string) {
    console.log('Emission du succès blockchain:', message);
    if (this.socketServer) {
      console.log('Socket server trouvé, émission du succès blockchain...');
      this.socketServer.emit('blockchainSuccessNotification', { message });
    }
  }
  
  /**
   * Émet un événement de nouvelle énigme à tous les clients connectés
   * @param riddle L'énigme à envoyer aux clients
   */
  emitNewRiddle(riddle: { id: string; question: string }) {
    console.log('Emission d\'une nouvelle énigme:', riddle.question);
    if (this.socketServer) {
      console.log('Socket server trouvé, émission de la nouvelle énigme...');
      this.socketServer.emit('newRiddle', {
        id: riddle.id,
        question: riddle.question,
        solvedBy: 'system' // Indiquer que c'est le système qui a défini la nouvelle énigme
      });
    }
  }
}
