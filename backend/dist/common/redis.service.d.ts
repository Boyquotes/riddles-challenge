import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private redisClient;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    getClient(): Redis;
    getRiddle(id: string): Promise<any>;
    getAllRiddleIds(): Promise<string[]>;
    getRandomRiddleId(): Promise<string>;
    seedRiddles(): Promise<void>;
}
