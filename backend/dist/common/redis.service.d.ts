import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EthereumService } from './ethereum.service';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly ethereumService;
    private redisClient;
    constructor(ethereumService: EthereumService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    getClient(): Redis;
    getRiddle(id: string): Promise<any>;
    getAllRiddleIds(): Promise<string[]>;
    getRandomRiddleId(): Promise<string>;
    seedRiddles(): Promise<void>;
    fetchAndStoreOnchainRiddle(): Promise<void>;
    private createLocalDummyOnchainRiddle;
}
