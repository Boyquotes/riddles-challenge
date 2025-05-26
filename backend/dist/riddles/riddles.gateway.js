"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiddlesGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const riddles_service_1 = require("./riddles.service");
const socket_service_1 = require("../common/socket.service");
let RiddlesGateway = class RiddlesGateway {
    constructor(riddlesService, socketService) {
        this.riddlesService = riddlesService;
        this.socketService = socketService;
        this.activeRiddleId = null;
        this.activePlayers = new Map();
        this.playerAnswers = new Map();
        this.globalAttemptedAnswers = new Map();
    }
    afterInit(server) {
        this.socketService.setSocketServer(server);
        console.log('WebSocket Gateway initialized and Socket.IO server provided to SocketService');
        server.on('connection', (socket) => {
            console.log(`Client connected to Socket.IO: ${socket.id}`);
            setTimeout(() => {
                console.log(`Test d'émission d'un événement blockchainErrorNotification au client ${socket.id}`);
                socket.emit('blockchainErrorNotification', { error: 'Test de notification d\'erreur blockchain' });
            }, 5000);
        });
    }
    getPlayerNumber(playerId) {
        const players = Array.from(this.activePlayers.keys());
        return players.indexOf(playerId) + 1;
    }
    async handleConnection(client) {
        console.log(`Client connected: ${client.id}`);
        this.activePlayers.set(client.id, client);
        if (!this.activeRiddleId) {
            const riddle = await this.riddlesService.getRandomRiddle();
            this.activeRiddleId = riddle.id;
            this.playerAnswers.set(this.activeRiddleId, new Set());
            this.globalAttemptedAnswers.set(this.activeRiddleId, new Set());
        }
        const currentRiddle = await this.riddlesService.getRiddle(this.activeRiddleId);
        client.emit('currentRiddle', {
            id: currentRiddle.id,
            question: currentRiddle.question,
        });
        this.server.emit('playerCount', this.activePlayers.size);
    }
    handleDisconnect(client) {
        console.log(`Client disconnected: ${client.id}`);
        this.activePlayers.delete(client.id);
        this.server.emit('playerCount', this.activePlayers.size);
    }
    handleBlockchainError(client, payload) {
        const { error } = payload;
        console.log(`Blockchain error from client ${client.id}:`, error);
        client.emit('blockchainErrorNotification', { error });
    }
    async handleSubmitAnswer(client, payload) {
        const playerId = client.id;
        const { answer } = payload;
        const normalizedAnswer = answer.toLowerCase().trim();
        const globalAnswers = this.globalAttemptedAnswers.get(this.activeRiddleId) || new Set();
        if (globalAnswers.has(normalizedAnswer)) {
            client.emit('answerResponse', {
                correct: false,
                message: 'This answer was already tried',
            });
            this.server.emit('duplicateAnswer', {
                playerId,
                playerNumber: this.getPlayerNumber(playerId),
                answer: normalizedAnswer,
                riddleId: this.activeRiddleId
            });
            return;
        }
        const answers = this.playerAnswers.get(this.activeRiddleId);
        const playerAnswerKey = `${playerId}:${normalizedAnswer}`;
        if (answers.has(playerAnswerKey)) {
            client.emit('answerResponse', {
                correct: false,
                message: 'You already tried this answer',
            });
            return;
        }
        answers.add(playerAnswerKey);
        globalAnswers.add(normalizedAnswer);
        this.globalAttemptedAnswers.set(this.activeRiddleId, globalAnswers);
        const isCorrect = await this.riddlesService.checkAnswer(this.activeRiddleId, answer);
        if (isCorrect) {
            const newRiddle = await this.riddlesService.getRandomRiddle();
            this.activeRiddleId = newRiddle.id;
            this.playerAnswers.set(this.activeRiddleId, new Set());
            this.globalAttemptedAnswers.set(this.activeRiddleId, new Set());
            this.server.emit('newRiddle', {
                id: newRiddle.id,
                question: newRiddle.question,
                solvedBy: playerId,
            });
            client.emit('answerResponse', {
                correct: true,
                message: 'Correct! You solved the riddle!',
            });
        }
        else {
            client.emit('answerResponse', {
                correct: false,
                message: 'Incorrect answer, try again!',
            });
            this.server.emit('wrongAnswer', {
                playerId,
                playerNumber: this.getPlayerNumber(playerId),
                answer,
                riddleId: this.activeRiddleId
            });
        }
    }
};
exports.RiddlesGateway = RiddlesGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RiddlesGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('blockchainError'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], RiddlesGateway.prototype, "handleBlockchainError", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('submitAnswer'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RiddlesGateway.prototype, "handleSubmitAnswer", null);
exports.RiddlesGateway = RiddlesGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [riddles_service_1.RiddlesService,
        socket_service_1.SocketService])
], RiddlesGateway);
//# sourceMappingURL=riddles.gateway.js.map