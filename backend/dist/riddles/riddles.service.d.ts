import { RedisService } from '../common/redis.service';
import { Riddle } from './models/riddle.model';
import { EthereumService } from '../common/ethereum.service';
import { MetaMaskTransaction } from './models/metamask-transaction.model';
export declare class RiddlesService {
    private readonly redisService;
    private readonly ethereumService;
    constructor(redisService: RedisService, ethereumService: EthereumService);
    getRiddle(id: string): Promise<Riddle>;
    getAllRiddles(): Promise<Riddle[]>;
    getRandomRiddle(): Promise<Riddle>;
    checkAnswer(id: string, answer: string): Promise<boolean>;
    checkOnchainAnswer(answer: string, riddle: any): Promise<boolean>;
    prepareMetaMaskTransaction(answer: string): MetaMaskTransaction;
}
