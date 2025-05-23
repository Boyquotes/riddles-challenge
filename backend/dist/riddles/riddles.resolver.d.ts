import { RiddlesService } from './riddles.service';
import { Riddle } from './models/riddle.model';
import { MetaMaskTransaction } from './models/metamask-transaction.model';
import { PubSub } from 'graphql-subscriptions';
export declare class RiddlesResolver {
    private readonly riddlesService;
    private pubSub;
    constructor(riddlesService: RiddlesService, pubSub: PubSub);
    riddle(id: string): Promise<Riddle>;
    riddles(): Promise<Riddle[]>;
    randomRiddle(): Promise<Riddle>;
    checkAnswer(id: string, answer: string, playerId: string): Promise<boolean>;
    prepareMetaMaskTransaction(answer: string): Promise<MetaMaskTransaction>;
    riddleSolved(): AsyncIterator<unknown, any, any>;
}
