import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EthereumService } from './ethereum.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(private readonly ethereumService: EthereumService) {
    this.redisClient = new Redis({
      host: 'localhost',
      port: 6379,
    });
  }

  async onModuleInit() {
    try {
      await this.redisClient.ping();
      console.log('Redis connection established');
      await this.seedRiddles();
    } catch (error) {
      console.error('Redis connection failed:', error);
    }
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  getClient(): Redis {
    return this.redisClient;
  }

  async getRiddle(id: string): Promise<any> {
    const riddle = await this.redisClient.hgetall(`riddle:${id}`);
    return riddle && Object.keys(riddle).length > 0 ? riddle : null;
  }

  async getAllRiddleIds(): Promise<string[]> {
    const keys = await this.redisClient.keys('riddle:*');
    return keys.map(key => key.replace('riddle:', ''));
  }

  async getRandomRiddleId(): Promise<string> {
    const ids = await this.getAllRiddleIds();
    
    // Check if we have an onchain riddle and if it's not solved
    const onchainRiddle = await this.getRiddle('onchain');
    if (onchainRiddle && onchainRiddle.solved === '0') {
      // Return the onchain riddle with higher probability (25%)
      if (Math.random() < 0.25) {
        return 'onchain';
      }
    }
    
    // Otherwise return a random regular riddle
    const filteredIds = ids.filter(id => id !== 'onchain');
    const randomIndex = Math.floor(Math.random() * filteredIds.length);
    return filteredIds[randomIndex];
  }

  async seedRiddles() {
    const count = await this.redisClient.keys('riddle:*');
    if (count.length > 0) {
      console.log(`${count.length} riddles already exist in Redis`);
      // Even if riddles exist, try to fetch and update the onchain riddle
      await this.fetchAndStoreOnchainRiddle();
      return;
    }
    // { question: 'What has keys but no locks, space but no room, and you can enter but not go in?', answer: 'keyboard' },
    const riddles = [
      { question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'echo' },
      { question: 'What gets wetter as it dries?', answer: 'towel' },
      { question: 'The more you take, the more you leave behind. What am I?', answer: 'footsteps' },
      { question: 'What has a head, a tail, but no body?', answer: 'coin' },
      // Adding more riddles to reach 100 would be done here
    ];

    // For demonstration, we'll add these 5 riddles and then duplicate them to reach 100
    const totalRiddles = 4;
    
    for (let i = 0; i < totalRiddles; i++) {
      const riddleIndex = i % riddles.length;
      const riddle = riddles[riddleIndex];
      
      // Add a suffix to make duplicated riddles slightly different
      const suffix = i >= riddles.length ? ` (variation ${Math.floor(i / riddles.length)})` : '';
      
      await this.redisClient.hset(
        `riddle:${i + 1}`,
        'id', `${i + 1}`,
        'question', riddle.question + suffix,
        'answer', riddle.answer,
        'solved', '0'
      );
    }

    console.log(`Seeded ${totalRiddles} riddles in Redis`);
    
    // Fetch and store the onchain riddle
    await this.fetchAndStoreOnchainRiddle();
  }

  async fetchAndStoreOnchainRiddle() {
    try {
      // Fetch the riddle from the Ethereum blockchain
      const onchainRiddleData = await this.ethereumService.getRiddle();
      
      if (onchainRiddleData.question && onchainRiddleData.isActive) {
        // Store the onchain riddle in Redis
        await this.redisClient.hset(
          'riddle:onchain',
          'id', 'onchain',
          'question', onchainRiddleData.question,
          'answer', '', // We don't know the answer, it's stored as a hash on the contract
          'solved', onchainRiddleData.winner !== '0x0000000000000000000000000000000000000000' ? '1' : '0',
          'onchain', '1', // Flag to identify this as an onchain riddle
          'isActive', onchainRiddleData.isActive ? '1' : '0'
        );
        console.log('Onchain riddle fetched and stored in Redis');
      } else {
        console.log('No active onchain riddle available');
      }
    } catch (error) {
      console.error('Failed to fetch onchain riddle:', error);
    }
  }
}
