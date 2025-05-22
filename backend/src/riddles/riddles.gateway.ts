import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RiddlesService } from './riddles.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RiddlesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeRiddleId: string = null;
  private activePlayers: Map<string, Socket> = new Map();
  private playerAnswers: Map<string, Set<string>> = new Map();

  constructor(private readonly riddlesService: RiddlesService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.activePlayers.set(client.id, client);
    
    // If there's no active riddle, get a new one
    if (!this.activeRiddleId) {
      const riddle = await this.riddlesService.getRandomRiddle();
      this.activeRiddleId = riddle.id;
      this.playerAnswers.set(this.activeRiddleId, new Set());
    }
    
    // Send the current riddle to the new player
    const currentRiddle = await this.riddlesService.getRiddle(this.activeRiddleId);
    client.emit('currentRiddle', {
      id: currentRiddle.id,
      question: currentRiddle.question,
    });
    
    // Broadcast the number of active players
    this.server.emit('playerCount', this.activePlayers.size);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.activePlayers.delete(client.id);
    this.server.emit('playerCount', this.activePlayers.size);
  }

  @SubscribeMessage('submitAnswer')
  async handleSubmitAnswer(client: Socket, payload: { answer: string }) {
    const playerId = client.id;
    const { answer } = payload;
    
    // Check if this player has already submitted this answer
    const answers = this.playerAnswers.get(this.activeRiddleId);
    const playerAnswerKey = `${playerId}:${answer.toLowerCase()}`;
    
    if (answers.has(playerAnswerKey)) {
      client.emit('answerResponse', {
        correct: false,
        message: 'You already tried this answer',
      });
      return;
    }
    
    // Add this answer to the set
    answers.add(playerAnswerKey);
    
    // Check if the answer is correct
    const isCorrect = await this.riddlesService.checkAnswer(this.activeRiddleId, answer);
    
    if (isCorrect) {
      // Get a new riddle
      const newRiddle = await this.riddlesService.getRandomRiddle();
      this.activeRiddleId = newRiddle.id;
      this.playerAnswers.set(this.activeRiddleId, new Set());
      
      // Broadcast the new riddle to all clients
      this.server.emit('newRiddle', {
        id: newRiddle.id,
        question: newRiddle.question,
        solvedBy: playerId,
      });
      
      client.emit('answerResponse', {
        correct: true,
        message: 'Correct! You solved the riddle!',
      });
    } else {
      client.emit('answerResponse', {
        correct: false,
        message: 'Incorrect answer, try again!',
      });
    }
  }
}
