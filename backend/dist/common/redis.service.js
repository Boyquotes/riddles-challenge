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
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const ethereum_service_1 = require("./ethereum.service");
let RedisService = class RedisService {
    constructor(ethereumService) {
        this.ethereumService = ethereumService;
        this.redisClient = new ioredis_1.Redis({
            host: 'localhost',
            port: 6379,
        });
    }
    async onModuleInit() {
        try {
            await this.redisClient.ping();
            console.log('Redis connection established');
            await this.seedRiddles();
        }
        catch (error) {
            console.error('Redis connection failed:', error);
        }
    }
    onModuleDestroy() {
        this.redisClient.disconnect();
    }
    getClient() {
        return this.redisClient;
    }
    async getRiddle(id) {
        const riddle = await this.redisClient.hgetall(`riddle:${id}`);
        return riddle && Object.keys(riddle).length > 0 ? riddle : null;
    }
    async getAllRiddleIds() {
        const keys = await this.redisClient.keys('riddle:*');
        return keys.map(key => key.replace('riddle:', ''));
    }
    async getRandomRiddleId() {
        const ids = await this.getAllRiddleIds();
        const unsolvedRiddles = [];
        const onchainRiddle = await this.getRiddle('onchain');
        if (onchainRiddle && onchainRiddle.solved === '0') {
            unsolvedRiddles.push('onchain');
        }
        const regularIds = ids.filter(id => id !== 'onchain');
        for (const id of regularIds) {
            const riddle = await this.getRiddle(id);
            if (riddle && riddle.solved === '0') {
                unsolvedRiddles.push(id);
            }
        }
        if (unsolvedRiddles.length === 0) {
            return 'game_over';
        }
        if (unsolvedRiddles.includes('onchain') && Math.random() < 0.25) {
            return 'onchain';
        }
        const randomIndex = Math.floor(Math.random() * unsolvedRiddles.length);
        return unsolvedRiddles[randomIndex];
    }
    async seedRiddles() {
        const count = await this.redisClient.keys('riddle:*');
        if (count.length > 0) {
            console.log(`${count.length} riddles already exist in Redis`);
            await this.fetchAndStoreOnchainRiddle();
            return;
        }
        const riddles = [
            { question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'echo' },
        ];
        const totalRiddles = 1;
        for (let i = 0; i < totalRiddles; i++) {
            const riddleIndex = i % riddles.length;
            const riddle = riddles[riddleIndex];
            const suffix = i >= riddles.length ? ` (variation ${Math.floor(i / riddles.length)})` : '';
            await this.redisClient.hset(`riddle:${i + 1}`, 'id', `${i + 1}`, 'question', riddle.question + suffix, 'answer', riddle.answer, 'solved', '0');
        }
        console.log(`Seeded ${totalRiddles} riddles in Redis`);
        await this.fetchAndStoreOnchainRiddle();
    }
    async fetchAndStoreOnchainRiddle() {
        try {
            const networkMode = process.env.NETWORK_MODE || 'testnet';
            if (networkMode === 'local') {
                console.log('Mode local détecté, vérification de la disponibilité du contrat sur Hardhat...');
                try {
                    const onchainRiddleData = await this.ethereumService.getRiddle();
                    if (onchainRiddleData.question && onchainRiddleData.isActive) {
                        await this.redisClient.hset('riddle:onchain', 'id', 'onchain', 'question', onchainRiddleData.question, 'answer', '', 'solved', onchainRiddleData.winner !== '0x0000000000000000000000000000000000000000' ? '1' : '0', 'onchain', '1', 'isActive', onchainRiddleData.isActive ? '1' : '0');
                        console.log('\u00c9nigme onchain récupérée et stockée dans Redis');
                    }
                    else {
                        console.log('Aucune énigme onchain active disponible sur le nœud Hardhat');
                        this.createLocalDummyOnchainRiddle();
                    }
                }
                catch (localError) {
                    console.warn('Impossible de récupérer l\'\u00e9nigme depuis le nœud Hardhat local:', localError.message);
                    console.log('Création d\'une énigme onchain factice pour le développement local...');
                    this.createLocalDummyOnchainRiddle();
                }
            }
            else {
                const onchainRiddleData = await this.ethereumService.getRiddle();
                if (onchainRiddleData.question && onchainRiddleData.isActive) {
                    await this.redisClient.hset('riddle:onchain', 'id', 'onchain', 'question', onchainRiddleData.question, 'answer', '', 'solved', onchainRiddleData.winner !== '0x0000000000000000000000000000000000000000' ? '1' : '0', 'onchain', '1', 'isActive', onchainRiddleData.isActive ? '1' : '0');
                    console.log('\u00c9nigme onchain récupérée et stockée dans Redis');
                }
                else {
                    console.log('Aucune énigme onchain active disponible sur Sepolia');
                }
            }
        }
        catch (error) {
            console.error('\u00c9chec lors de la récupération de l\'\u00e9nigme onchain:', error);
        }
    }
    async createLocalDummyOnchainRiddle() {
        try {
            await this.redisClient.hset('riddle:onchain', 'id', 'onchain', 'question', 'Ceci est une énigme de test pour le développement local avec Hardhat. Quelle est la réponse?', 'answer', '', 'solved', '0', 'onchain', '1', 'isActive', '1');
            console.log('\u00c9nigme onchain factice créée pour le développement local');
        }
        catch (error) {
            console.error('\u00c9chec lors de la création de l\'\u00e9nigme onchain factice:', error);
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ethereum_service_1.EthereumService])
], RedisService);
//# sourceMappingURL=redis.service.js.map