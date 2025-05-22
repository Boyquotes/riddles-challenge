import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RiddlesService } from './riddles.service';
export declare class RiddlesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly riddlesService;
    server: Server;
    private activeRiddleId;
    private activePlayers;
    private playerAnswers;
    constructor(riddlesService: RiddlesService);
    private getPlayerNumber;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleSubmitAnswer(client: Socket, payload: {
        answer: string;
    }): Promise<void>;
}
