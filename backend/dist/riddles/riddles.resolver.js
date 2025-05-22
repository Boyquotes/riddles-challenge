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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiddlesResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const riddles_service_1 = require("./riddles.service");
const riddle_model_1 = require("./models/riddle.model");
const riddle_solved_model_1 = require("./models/riddle-solved.model");
const common_1 = require("@nestjs/common");
const constants_1 = require("../common/constants");
const graphql_subscriptions_1 = require("graphql-subscriptions");
let RiddlesResolver = class RiddlesResolver {
    constructor(riddlesService, pubSub) {
        this.riddlesService = riddlesService;
        this.pubSub = pubSub;
    }
    async riddle(id) {
        return this.riddlesService.getRiddle(id);
    }
    async riddles() {
        return this.riddlesService.getAllRiddles();
    }
    async randomRiddle() {
        return this.riddlesService.getRandomRiddle();
    }
    async checkAnswer(id, answer, playerId) {
        const isCorrect = await this.riddlesService.checkAnswer(id, answer);
        if (isCorrect) {
            const newRiddle = await this.riddlesService.getRandomRiddle();
            this.pubSub.publish('riddleSolved', {
                riddleSolved: {
                    solvedBy: playerId,
                    newRiddle,
                }
            });
        }
        return isCorrect;
    }
    riddleSolved() {
        return this.pubSub.asyncIterator('riddleSolved');
    }
};
exports.RiddlesResolver = RiddlesResolver;
__decorate([
    (0, graphql_1.Query)(() => riddle_model_1.Riddle),
    __param(0, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RiddlesResolver.prototype, "riddle", null);
__decorate([
    (0, graphql_1.Query)(() => [riddle_model_1.Riddle]),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RiddlesResolver.prototype, "riddles", null);
__decorate([
    (0, graphql_1.Query)(() => riddle_model_1.Riddle),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RiddlesResolver.prototype, "randomRiddle", null);
__decorate([
    (0, graphql_1.Mutation)(() => Boolean),
    __param(0, (0, graphql_1.Args)('id')),
    __param(1, (0, graphql_1.Args)('answer')),
    __param(2, (0, graphql_1.Args)('playerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RiddlesResolver.prototype, "checkAnswer", null);
__decorate([
    (0, graphql_1.Subscription)(() => riddle_solved_model_1.RiddleSolvedResponse, {
        name: 'riddleSolved',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RiddlesResolver.prototype, "riddleSolved", null);
exports.RiddlesResolver = RiddlesResolver = __decorate([
    (0, graphql_1.Resolver)(() => riddle_model_1.Riddle),
    __param(1, (0, common_1.Inject)(constants_1.PUB_SUB)),
    __metadata("design:paramtypes", [riddles_service_1.RiddlesService,
        graphql_subscriptions_1.PubSub])
], RiddlesResolver);
//# sourceMappingURL=riddles.resolver.js.map