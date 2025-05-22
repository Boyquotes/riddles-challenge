import { RedisService } from '../common/redis.service';
import { Riddle } from './models/riddle.model';
export declare class RiddlesService {
    private readonly redisService;
    constructor(redisService: RedisService);
    getRiddle(id: string): Promise<Riddle>;
    getAllRiddles(): Promise<Riddle[]>;
    getRandomRiddle(): Promise<Riddle>;
    checkAnswer(id: string, answer: string): Promise<boolean>;
}
