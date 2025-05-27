import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { Riddle } from './models/riddle.model';
import { EthereumService } from '../common/ethereum.service';
import { ethers } from 'ethers';
import { MetaMaskTransaction } from './models/metamask-transaction.model';
import { GameOverStats, PlayerStat } from './models/game-over-stats.model';

@Injectable()
export class RiddlesService {
  private readonly logger = new Logger(RiddlesService.name);
  private availableRiddles: Array<{ text: string; answer: string }> = [
    { text: "What has keys but no locks, space but no room, and you can enter but not go in?", answer: "keyboard" },
    { text: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo" },
    { text: "The more you take, the more you leave behind. What am I?", answer: "footsteps" },
    { text: "What has a head, a tail, is brown, and has no legs?", answer: "penny" },
    { text: "What gets wet while drying?", answer: "towel" },
    { text: "What can you catch but not throw?", answer: "cold" },
    { text: "What has many keys but can't open a single lock?", answer: "piano" },
    { text: "What has to be broken before you can use it?", answer: "egg" },
    { text: "What begins with T, ends with T, and has T in it?", answer: "teapot" },
    { text: "What has one eye but cannot see?", answer: "needle" }
  ];

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
      // Get player statistics from blockchain
      const stats = await this.getGameOverStats();
      
      return {
        id: 'game_over',
        question: `Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.\n\nStatistiques des joueurs:\n${stats.message}`,
        solved: true,
        answer: 'Merci d\'avoir joué !'
      };
    }
    
    return this.getRiddle(id);
  }
  
  /**
   * Récupère les statistiques de fin de jeu
   * Affiche le nombre de victoires pour chaque joueur connecté
   */
  async getGameOverStats(): Promise<GameOverStats> {
    try {
      // Récupérer les statistiques des joueurs depuis la blockchain
      const playerStatsMap = await this.ethereumService.getPlayerStatistics();
      
      // Convertir en tableau pour l'affichage
      const playerStats: PlayerStat[] = Object.entries(playerStatsMap).map(([address, victories]) => ({
        address,
        victories
      }));
      
      // Trier par nombre de victoires (décroissant)
      playerStats.sort((a, b) => b.victories - a.victories);
      
      // Formater le message pour l'affichage
      let message = '';
      if (playerStats.length === 0) {
        message = 'Aucun joueur n\'a encore résolu d\'énigme onchain.';
      } else {
        message = playerStats.map((stat, index) => 
          `${index + 1}. ${this.formatAddress(stat.address)}: ${stat.victories} victoire${stat.victories > 1 ? 's' : ''}`
        ).join('\n');
      }
      
      return {
        message,
        playerStats
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques de fin de jeu:', error);
      return {
        message: 'Impossible de récupérer les statistiques des joueurs.',
        playerStats: []
      };
    }
  }
  
  /**
   * Formate une adresse Ethereum pour l'affichage
   * Affiche les 6 premiers et 4 derniers caractères séparés par '...'
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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
      
      // When a riddle is solved, try to set the next riddle in the blockchain
      await this.setNextRiddleInBlockchain();
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
        this.logger.log('Riddle is no longer active on the blockchain');
        return false;
      }
      
      // We can't directly check if the answer is correct without revealing the hash
      // So we'll submit the answer to the contract and check the result
      // This is a read-only call that doesn't modify the blockchain state
      const isCorrect = await this.ethereumService.checkAnswer(answer);
      
      if (isCorrect) {
        // Update the riddle status in Redis
        await this.redisService.getClient().hset('riddle:onchain', 'solved', '1');
        this.logger.log('Onchain riddle solved correctly!');
        
        // When an onchain riddle is solved, set the next riddle in the blockchain
        await this.setNextRiddleInBlockchain();
      }
      
      return isCorrect;
    } catch (error) {
      this.logger.error('Error checking onchain answer:', error);
      return false;
    }
  }
  
  /**
   * Définit la prochaine énigme dans la blockchain lorsqu'une énigme est résolue
   * Sélectionne une énigme aléatoire parmi celles disponibles
   */
  async setNextRiddleInBlockchain(): Promise<boolean> {
    try {
      this.logger.log('Tentative de définition de la prochaine énigme dans la blockchain...');
      
      // Vérifier si nous avons une clé privée pour signer la transaction
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        this.logger.warn('Aucune clé privée disponible pour définir la prochaine énigme');
        return false;
      }
      
      // Définir la prochaine énigme dans la blockchain
      const success = await this.ethereumService.setNextRiddle(this.availableRiddles, privateKey);
      
      if (success) {
        this.logger.log('Prochaine énigme définie avec succès dans la blockchain');
        
        // Mettre à jour l'énigme onchain dans Redis
        await this.redisService.fetchAndStoreOnchainRiddle();
      }
      
      return success;
    } catch (error) {
      this.logger.error('Erreur lors de la définition de la prochaine énigme dans la blockchain:', error);
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
