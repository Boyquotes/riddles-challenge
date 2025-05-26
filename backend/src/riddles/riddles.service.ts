import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { Riddle } from './models/riddle.model';
import { EthereumService } from '../common/ethereum.service';
import { ethers } from 'ethers';
import { MetaMaskTransaction } from './models/metamask-transaction.model';

@Injectable()
export class RiddlesService {
  constructor(
    private readonly redisService: RedisService,
    private readonly ethereumService: EthereumService
  ) {}

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
    
    // Check if game is over (all riddles solved)
    if (id === 'game_over') {
      return {
        id: 'game_over',
        question: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.',
        solved: true,
        answer: 'Merci d\'avoir joué !'
      };
    }
    
    return this.getRiddle(id);
  }

  async checkAnswer(id: string, answer: string): Promise<boolean> {
    const riddle = await this.redisService.getRiddle(id);
    if (!riddle) {
      return false;
    }

    // Check if this is an onchain riddle
    if (id === 'onchain' || riddle.onchain === '1') {
      return this.checkOnchainAnswer(answer, riddle);
    }

    // Regular riddle check
    const isCorrect = riddle.answer.toLowerCase() === answer.toLowerCase();
    if (isCorrect) {
      await this.redisService.getClient().hset(`riddle:${id}`, 'solved', '1');
    }
    
    return isCorrect;
  }

  async checkOnchainAnswer(answer: string, riddle: any): Promise<boolean> {
    try {
      // Calculate the hash of the answer
      const answerHash = ethers.keccak256(ethers.toUtf8Bytes(answer));
      
      // Get the contract instance from the EthereumService
      const contract = this.ethereumService.getContract();
      
      // Check if the riddle is still active
      const isActive = await contract.isActive();
      if (!isActive) {
        console.log('Riddle is no longer active on the blockchain');
        return false;
      }
      
      // We can't directly check if the answer is correct without revealing the hash
      // So we'll submit the answer to the contract and check the result
      // This is a read-only call that doesn't modify the blockchain state
      const isCorrect = await this.ethereumService.checkAnswer(answer);
      
      if (isCorrect) {
        // Update the riddle status in Redis
        await this.redisService.getClient().hset('riddle:onchain', 'solved', '1');
        console.log('Onchain riddle solved correctly!');
      }
      
      return isCorrect;
    } catch (error) {
      console.error('Error checking onchain answer:', error);
      return false;
    }
  }
  
  /**
   * Prepare transaction data for MetaMask to submit an answer to the contract
   * This returns the data needed for the frontend to create a transaction with MetaMask
   * @throws Error if the riddle is not active or other blockchain errors
   */
  async prepareMetaMaskTransaction(answer: string): Promise<MetaMaskTransaction> {
    try {
      return await this.ethereumService.prepareMetaMaskTransaction(answer);
    } catch (error) {
      // Propager l'erreur pour que le resolver puisse la gérer
      throw error;
    }
  }
}
