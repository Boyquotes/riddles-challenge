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
let RedisService = class RedisService {
    constructor() {
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
        const randomIndex = Math.floor(Math.random() * ids.length);
        return ids[randomIndex];
    }
    async seedRiddles() {
        const count = await this.redisClient.keys('riddle:*');
        if (count.length > 0) {
            console.log(`${count.length} riddles already exist in Redis`);
            return;
        }
        const riddles = [
            { question: 'What has keys but no locks, space but no room, and you can enter but not go in?', answer: 'keyboard' },
            { question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'echo' },
            { question: 'What gets wetter as it dries?', answer: 'towel' },
            { question: 'The more you take, the more you leave behind. What am I?', answer: 'footsteps' },
            { question: 'What has a head, a tail, but no body?', answer: 'coin' },
        ];
        const totalRiddles = 100;
        for (let i = 0; i < totalRiddles; i++) {
            const riddleIndex = i % riddles.length;
            const riddle = riddles[riddleIndex];
            const suffix = i >= riddles.length ? ` (variation ${Math.floor(i / riddles.length)})` : '';
            await this.redisClient.hset(`riddle:${i + 1}`, 'id', `${i + 1}`, 'question', riddle.question + suffix, 'answer', riddle.answer, 'solved', '0');
        }
        console.log(`Seeded ${totalRiddles} riddles in Redis`);
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisService);
//# sourceMappingURL=redis.service.js.map