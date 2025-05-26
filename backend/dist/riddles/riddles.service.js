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
exports.RiddlesService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../common/redis.service");
const ethereum_service_1 = require("../common/ethereum.service");
const ethers_1 = require("ethers");
let RiddlesService = class RiddlesService {
    constructor(redisService, ethereumService) {
        this.redisService = redisService;
        this.ethereumService = ethereumService;
    }
    async getRiddle(id) {
        const riddle = await this.redisService.getRiddle(id);
        if (!riddle) {
            return null;
        }
        return {
            id: riddle.id,
            question: riddle.question,
            solved: riddle.solved === '1',
            answer: riddle.solved === '1' ? riddle.answer : undefined,
        };
    }
    async getAllRiddles() {
        const ids = await this.redisService.getAllRiddleIds();
        const riddles = await Promise.all(ids.map(id => this.getRiddle(id)));
        return riddles.filter(riddle => riddle !== null);
    }
    async getRandomRiddle() {
        const id = await this.redisService.getRandomRiddleId();
        if (id === 'game_over') {
            return {
                id: 'game_over',
                question: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.',
                solved: true,
                answer: 'Merci d\'avoir joué !'
            };
        }
        return this.getRiddle(id);
    }
    async checkAnswer(id, answer) {
        const riddle = await this.redisService.getRiddle(id);
        if (!riddle) {
            return false;
        }
        if (id === 'onchain' || riddle.onchain === '1') {
            return this.checkOnchainAnswer(answer, riddle);
        }
        const isCorrect = riddle.answer.toLowerCase() === answer.toLowerCase();
        if (isCorrect) {
            await this.redisService.getClient().hset(`riddle:${id}`, 'solved', '1');
        }
        return isCorrect;
    }
    async checkOnchainAnswer(answer, riddle) {
        try {
            const answerHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(answer));
            const contract = this.ethereumService.getContract();
            const isActive = await contract.isActive();
            if (!isActive) {
                console.log('Riddle is no longer active on the blockchain');
                return false;
            }
            const isCorrect = await this.ethereumService.checkAnswer(answer);
            if (isCorrect) {
                await this.redisService.getClient().hset('riddle:onchain', 'solved', '1');
                console.log('Onchain riddle solved correctly!');
            }
            return isCorrect;
        }
        catch (error) {
            console.error('Error checking onchain answer:', error);
            return false;
        }
    }
    async prepareMetaMaskTransaction(answer) {
        try {
            return await this.ethereumService.prepareMetaMaskTransaction(answer);
        }
        catch (error) {
            throw error;
        }
    }
};
exports.RiddlesService = RiddlesService;
exports.RiddlesService = RiddlesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        ethereum_service_1.EthereumService])
], RiddlesService);
//# sourceMappingURL=riddles.service.js.map