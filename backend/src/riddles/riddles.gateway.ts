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
  private globalAttemptedAnswers: Map<string, Set<string>> = new Map();

  constructor(private readonly riddlesService: RiddlesService) {}
  
  // Helper method to get the player number based on connection order
  private getPlayerNumber(playerId: string): number {
    // Convert the Map to an array and find the index of the player
    const players = Array.from(this.activePlayers.keys());
    return players.indexOf(playerId) + 1;
  }

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.activePlayers.set(client.id, client);
    
    // If there's no active riddle, get a new one
    if (!this.activeRiddleId) {
      const riddle = await this.riddlesService.getRandomRiddle();
      this.activeRiddleId = riddle.id;
      this.playerAnswers.set(this.activeRiddleId, new Set());
      this.globalAttemptedAnswers.set(this.activeRiddleId, new Set());
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
    const normalizedAnswer = answer.toLowerCase().trim();
    
    // Get the set of globally attempted answers for the current riddle
    const globalAnswers = this.globalAttemptedAnswers.get(this.activeRiddleId) || new Set();
    
    // Check if any player has already submitted this answer
    if (globalAnswers.has(normalizedAnswer)) {
      // Send response to the client who submitted the answer
      client.emit('answerResponse', {
        correct: false,
        message: 'This answer was already tried',
      });
      
      // Broadcast to all clients that this answer was already tried
      this.server.emit('duplicateAnswer', {
        playerId,
        playerNumber: this.getPlayerNumber(playerId),
        answer: normalizedAnswer,
        riddleId: this.activeRiddleId
      });
      
      return;
    }
    
    // Check if this player has already submitted this answer
    const answers = this.playerAnswers.get(this.activeRiddleId);
    const playerAnswerKey = `${playerId}:${normalizedAnswer}`;
    
    if (answers.has(playerAnswerKey)) {
      client.emit('answerResponse', {
        correct: false,
        message: 'You already tried this answer',
      });
      return;
    }
    
    // Add this answer to both the player-specific set and the global set
    answers.add(playerAnswerKey);
    globalAnswers.add(normalizedAnswer);
    this.globalAttemptedAnswers.set(this.activeRiddleId, globalAnswers);
    
    // Check if the answer is correct
    const isCorrect = await this.riddlesService.checkAnswer(this.activeRiddleId, answer);
    
    if (isCorrect) {
      // Get a new riddle
      const newRiddle = await this.riddlesService.getRandomRiddle();
      this.activeRiddleId = newRiddle.id;
      this.playerAnswers.set(this.activeRiddleId, new Set());
      this.globalAttemptedAnswers.set(this.activeRiddleId, new Set());
      
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
      // Send response to the client who submitted the answer
      client.emit('answerResponse', {
        correct: false,
        message: 'Incorrect answer, try again!',
      });
      
      // Broadcast the wrong answer to all clients
      this.server.emit('wrongAnswer', {
        playerId,
        playerNumber: this.getPlayerNumber(playerId),
        answer,
        riddleId: this.activeRiddleId
      });
    }
  }
}
