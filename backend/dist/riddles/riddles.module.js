"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiddlesModule = void 0;
const common_1 = require("@nestjs/common");
const riddles_resolver_1 = require("./riddles.resolver");
const riddles_service_1 = require("./riddles.service");
const redis_service_1 = require("../common/redis.service");
const riddles_gateway_1 = require("./riddles.gateway");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const constants_1 = require("../common/constants");
let RiddlesModule = class RiddlesModule {
};
exports.RiddlesModule = RiddlesModule;
exports.RiddlesModule = RiddlesModule = __decorate([
    (0, common_1.Module)({
        providers: [
            riddles_resolver_1.RiddlesResolver,
            riddles_service_1.RiddlesService,
            redis_service_1.RedisService,
            riddles_gateway_1.RiddlesGateway,
            {
                provide: constants_1.PUB_SUB,
                useValue: new graphql_subscriptions_1.PubSub(),
            },
        ],
        exports: [riddles_service_1.RiddlesService],
    })
], RiddlesModule);
//# sourceMappingURL=riddles.module.js.map