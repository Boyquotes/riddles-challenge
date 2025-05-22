import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { RiddlesService } from './riddles.service';
import { Riddle } from './models/riddle.model';
import { RiddleSolvedResponse } from './models/riddle-solved.model';
import { Inject } from '@nestjs/common';
import { PUB_SUB } from '../common/constants';
import { PubSub } from 'graphql-subscriptions';

@Resolver(() => Riddle)
export class RiddlesResolver {
  constructor(
    private readonly riddlesService: RiddlesService,
    @Inject(PUB_SUB) private pubSub: PubSub
  ) {}

  @Query(() => Riddle)
  async riddle(@Args('id') id: string): Promise<Riddle> {
    return this.riddlesService.getRiddle(id);
  }

  @Query(() => [Riddle])
  async riddles(): Promise<Riddle[]> {
    return this.riddlesService.getAllRiddles();
  }

  @Query(() => Riddle)
  async randomRiddle(): Promise<Riddle> {
    return this.riddlesService.getRandomRiddle();
  }

  @Mutation(() => Boolean)
  async checkAnswer(
    @Args('id') id: string,
    @Args('answer') answer: string,
    @Args('playerId') playerId: string,
  ): Promise<boolean> {
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

  @Subscription(() => RiddleSolvedResponse, {
    name: 'riddleSolved',
  })
  riddleSolved() {
    return this.pubSub.asyncIterator('riddleSolved');
  }
}
