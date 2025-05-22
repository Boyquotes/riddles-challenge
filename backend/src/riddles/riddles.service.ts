import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { Riddle } from './models/riddle.model';

@Injectable()
export class RiddlesService {
  constructor(private readonly redisService: RedisService) {}

  async getRiddle(id: string): Promise<Riddle> {
    const riddle = await this.redisService.getRiddle(id);
    if (!riddle) {
      return null;
    }
    
    return {
      id: riddle.id,
      question: riddle.question,
      solved: riddle.solved === '1',
      answer: riddle.solved === '1' ? riddle.answer : undefined,
    };
  }

  async getAllRiddles(): Promise<Riddle[]> {
    const ids = await this.redisService.getAllRiddleIds();
    const riddles = await Promise.all(ids.map(id => this.getRiddle(id)));
    return riddles.filter(riddle => riddle !== null);
  }

  async getRandomRiddle(): Promise<Riddle> {
    const id = await this.redisService.getRandomRiddleId();
    return this.getRiddle(id);
  }

  async checkAnswer(id: string, answer: string): Promise<boolean> {
    const riddle = await this.redisService.getRiddle(id);
    if (!riddle) {
      return false;
    }

    const isCorrect = riddle.answer.toLowerCase() === answer.toLowerCase();
    if (isCorrect) {
      await this.redisService.getClient().hset(`riddle:${id}`, 'solved', '1');
    }
    
    return isCorrect;
  }
}
