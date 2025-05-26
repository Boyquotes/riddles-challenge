import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

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
}
