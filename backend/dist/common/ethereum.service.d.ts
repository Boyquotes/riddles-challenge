import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SocketService } from './socket.service';
type OnchainRiddleContract = ethers.Contract;
export declare class EthereumService implements OnModuleInit, OnModuleDestroy {
    private readonly eventEmitter;
    private readonly socketService;
    private readonly logger;
    private provider;
    private contract;
    private eventListeners;
    constructor(eventEmitter: EventEmitter2, socketService: SocketService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    testEmitBlockchainError(): void;
    setupEventListeners(): Promise<void>;
    cleanupEventListeners(): Promise<void>;
    getContract(): OnchainRiddleContract;
    getRiddle(): Promise<{
        question: string;
        isActive: boolean;
        winner: string;
    }>;
    checkAnswer(answer: string): Promise<boolean>;
    prepareMetaMaskTransaction(answer: string): Promise<{
        to: string;
        data: string;
        chainId: number;
        networkName: string;
        currencyName: string;
        rpcUrl: string;
        blockExplorer: string;
    }>;
    submitAnswer(answer: string, walletKey?: string): Promise<boolean>;
}
export {};
