import { RiddlesService } from './riddles.service';
import { Riddle } from './models/riddle.model';
import { PubSub } from 'graphql-subscriptions';
export declare class RiddlesResolver {
    private readonly riddlesService;
    private pubSub;
    constructor(riddlesService: RiddlesService, pubSub: PubSub);
    riddle(id: string): Promise<Riddle>;
    riddles(): Promise<Riddle[]>;
    randomRiddle(): Promise<Riddle>;
    checkAnswer(id: string, answer: string, playerId: string): Promise<boolean>;
    riddleSolved(): AsyncIterator<unknown, any, any>;
}
