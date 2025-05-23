import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { RIDDLE_CONTRACT_ABI, RIDDLE_CONTRACT_ADDRESS, SEPOLIA_RPC_URL } from './ethereum.constants';

@Injectable()
export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    this.contract = new ethers.Contract(
      RIDDLE_CONTRACT_ADDRESS,
      RIDDLE_CONTRACT_ABI,
      this.provider
    );
  }

  async getRiddle(): Promise<{ question: string; isActive: boolean; winner: string }> {
    try {
      const riddleText = await this.contract.riddle();
      const isActive = await this.contract.isActive();
      const winner = await this.contract.winner();
      
      return {
        question: riddleText,
        isActive,
        winner
      };
    } catch (error) {
      console.error('Error fetching riddle from blockchain:', error);
      throw new Error('Failed to fetch riddle from blockchain');
    }
  }
}
