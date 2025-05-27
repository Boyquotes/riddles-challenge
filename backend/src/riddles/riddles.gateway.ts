import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RiddlesService } from './riddles.service';
import { SocketService } from '../common/socket.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RiddlesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private activeRiddleId: string = null;
  private activePlayers: Map<string, Socket> = new Map();
  private playerAnswers: Map<string, Set<string>> = new Map();
  private globalAttemptedAnswers: Map<string, Set<string>> = new Map();

  constructor(
    private readonly riddlesService: RiddlesService,
    private readonly socketService: SocketService
  ) {}
  
  afterInit(server: Server) {
    // Fournir l'instance du serveur Socket.IO au SocketService
    this.socketService.setSocketServer(server);
    console.log('WebSocket Gateway initialized and Socket.IO server provided to SocketService');
    
    // Ajouter un écouteur d'événements global pour déboguer
    server.on('connection', (socket) => {
      console.log(`Client connected to Socket.IO: ${socket.id}`);
      
      // Test d'émission d'un événement blockchain error pour déboguer
      // setTimeout(() => {
      //   console.log(`Test d'émission d'un événement blockchainErrorNotification au client ${socket.id}`);
      //   socket.emit('blockchainErrorNotification', { error: 'Test de notification d\'erreur blockchain' });
      // }, 5000);
    });
  }
  
  // Helper method to get the player number based on connection order
  private getPlayerNumber(playerId: string): number {
    // Convert the Map to an array and find the index of the player
    const players = Array.from(this.activePlayers.keys());
    return players.indexOf(playerId) + 1;
  }

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.activePlayers.set(client.id, client);
    
    // If there's no active riddle, get a new one (will be onchain or game_over)
    if (!this.activeRiddleId) {
      const riddle = await this.riddlesService.getRandomRiddle();
      this.activeRiddleId = riddle.id;
      this.playerAnswers.set(this.activeRiddleId, new Set());
      this.globalAttemptedAnswers.set(this.activeRiddleId, new Set());
    }
    
    // Get the current riddle (onchain or game_over)
    const currentRiddle = this.activeRiddleId === 'game_over' ?
      await this.riddlesService.getRandomRiddle() :
      await this.riddlesService.getRiddle(this.activeRiddleId);
    
    // Send the riddle to the client
    if (currentRiddle) {
      client.emit('currentRiddle', {
        id: currentRiddle.id,
        question: currentRiddle.question,
      });
    } else {
      // Fallback if no riddle is available
      console.error(`Could not find riddle with ID: ${this.activeRiddleId}`);
      // Get a new random riddle as fallback (will be game_over in this case)
      const fallbackRiddle = await this.riddlesService.getRandomRiddle();
      this.activeRiddleId = fallbackRiddle.id;
      client.emit('currentRiddle', {
        id: fallbackRiddle.id,
        question: fallbackRiddle.question,
      });
    }
    
    // Broadcast the number of active players
    this.server.emit('playerCount', this.activePlayers.size);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.activePlayers.delete(client.id);
    this.server.emit('playerCount', this.activePlayers.size);
  }

  @SubscribeMessage('blockchainError')
  handleBlockchainError(client: Socket, payload: { error: string }) {
    const { error } = payload;
    
    // Log the error on the server side
    console.log(`Blockchain error from client ${client.id}:`, error);
    
    // Broadcast the error to all clients or just to the client who experienced it
    // Option 1: Broadcast to all clients
    // this.server.emit('blockchainErrorNotification', { error });
    
    // Option 2: Send only to the client who experienced the error
    client.emit('blockchainErrorNotification', { error });
  }

  @SubscribeMessage('submitAnswer')
  async handleSubmitAnswer(client: Socket, payload: { answer: string }) {
    const playerId = client.id;
    const { answer } = payload;
    const normalizedAnswer = answer.toLowerCase().trim();
    
    // If we're in game_over state, don't process answers
    if (this.activeRiddleId === 'game_over') {
      client.emit('answerResponse', {
        correct: false,
        message: 'Game is over. All riddles have been solved.',
      });
      return;
    }
    
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
    
    // Check if the answer is correct (only onchain riddles now)
    const isCorrect = await this.riddlesService.checkAnswer(this.activeRiddleId, answer);
    
    if (isCorrect) {
      // Get a new riddle (will be game_over if the onchain riddle was solved)
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
