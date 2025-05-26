import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RiddlesService } from './riddles.service';
import { SocketService } from '../common/socket.service';
export declare class RiddlesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private readonly riddlesService;
    private readonly socketService;
    server: Server;
    private activeRiddleId;
    private activePlayers;
    private playerAnswers;
    private globalAttemptedAnswers;
    constructor(riddlesService: RiddlesService, socketService: SocketService);
    afterInit(server: Server): void;
    private getPlayerNumber;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleBlockchainError(client: Socket, payload: {
        error: string;
    }): void;
    handleSubmitAnswer(client: Socket, payload: {
        answer: string;
    }): Promise<void>;
}
