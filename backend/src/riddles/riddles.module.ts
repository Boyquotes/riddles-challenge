import { Module } from '@nestjs/common';
import { RiddlesResolver } from './riddles.resolver';
import { RiddlesService } from './riddles.service';
import { RedisService } from '../common/redis.service';
import { RiddlesGateway } from './riddles.gateway';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../common/constants';
import { EthereumService } from '../common/ethereum.service';

@Module({
  providers: [
    RiddlesResolver, 
    RiddlesService, 
    RedisService, 
    RiddlesGateway,
    EthereumService,
    {
      provide: PUB_SUB,
      useValue: new PubSub(),
    },
  ],
  exports: [RiddlesService],
})
export class RiddlesModule {}
