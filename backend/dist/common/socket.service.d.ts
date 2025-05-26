import { Server } from 'socket.io';
export declare class SocketService {
    private socketServer;
    setSocketServer(server: Server): void;
    getSocketServer(): Server;
    emitBlockchainError(error: string): void;
    emitBlockchainSuccess(message: string): void;
}
