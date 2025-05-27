import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ethers } from 'ethers';
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
    
    // Get all riddles that are not solved
    const unsolvedRiddles = [];
    
    // Check if we have an onchain riddle and if it's not solved
    const onchainRiddle = await this.getRiddle('onchain');
    if (onchainRiddle && onchainRiddle.solved === '0') {
      unsolvedRiddles.push('onchain');
    }
    
    // Get all other unsolved riddles
    const regularIds = ids.filter(id => id !== 'onchain');
    for (const id of regularIds) {
      const riddle = await this.getRiddle(id);
      if (riddle && riddle.solved === '0') {
        unsolvedRiddles.push(id);
      }
    }
    
    // If there are no unsolved riddles, return a special ID
    if (unsolvedRiddles.length === 0) {
      return 'game_over';
    }
    
    // Prioritize onchain riddle with higher probability (25%)
    if (unsolvedRiddles.includes('onchain') && Math.random() < 0.25) {
      return 'onchain';
    }
    
    // Otherwise return a random unsolved riddle
    const randomIndex = Math.floor(Math.random() * unsolvedRiddles.length);
    return unsolvedRiddles[randomIndex];
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
      // Adding more riddles to reach 100 would be done here
    ];

    // For demonstration, we'll add these 5 riddles and then duplicate them to reach 100
    const totalRiddles = 1;
    
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
      // Vérifier le mode réseau
      const networkMode = process.env.NETWORK_MODE || 'testnet';
      
      if (networkMode === 'local') {
        console.log('Mode local détecté, vérification de la disponibilité du contrat sur Hardhat...');
        
        try {
          // Essayer de récupérer l'énigme depuis la blockchain locale
          const onchainRiddleData = await this.ethereumService.getRiddle();
          
          if (onchainRiddleData.question && onchainRiddleData.isActive) {
            // Stocker l'énigme onchain dans Redis
            await this.redisClient.hset(
              'riddle:onchain',
              'id', 'onchain',
              'question', onchainRiddleData.question,
              'answer', '0x4a1b974e31e005ad301f0f7ef6ff3d756c261fe66213c0faa95f27c2befaed31', // Hash keccak256 du mot 'simple'
              'solved', onchainRiddleData.winner !== '0x0000000000000000000000000000000000000000' ? '1' : '0',
              'onchain', '1', // Flag pour identifier que c'est une énigme onchain
              'isActive', onchainRiddleData.isActive ? '1' : '0'
            );
            console.log('\u00c9nigme onchain récupérée et stockée dans Redis');
          } else {
            console.log('Aucune énigme onchain active disponible sur le nœud Hardhat');
            // Créer une énigme onchain factice pour le développement local
            this.createLocalDummyOnchainRiddle();
          }
        } catch (localError) {
          console.warn('Impossible de récupérer l\'\u00e9nigme depuis le nœud Hardhat local:', localError.message);
          console.log('Création d\'une énigme onchain factice pour le développement local...');
          // Créer une énigme onchain factice pour le développement local
          this.createLocalDummyOnchainRiddle();
        }
      } else {
        // Mode testnet (Sepolia)
        // Récupérer l'énigme depuis la blockchain Ethereum
        const onchainRiddleData = await this.ethereumService.getRiddle();
        
        if (onchainRiddleData.question && onchainRiddleData.isActive) {
          // Stocker l'énigme onchain dans Redis
          await this.redisClient.hset(
            'riddle:onchain',
            'id', 'onchain',
            'question', onchainRiddleData.question,
            'answer', '', // On ne connaît pas la réponse, elle est stockée sous forme de hash dans le contrat
            'solved', onchainRiddleData.winner !== '0x0000000000000000000000000000000000000000' ? '1' : '0',
            'onchain', '1', // Flag pour identifier que c'est une énigme onchain
            'isActive', onchainRiddleData.isActive ? '1' : '0'
          );
          console.log('\u00c9nigme onchain récupérée et stockée dans Redis');
        } else {
          console.log('Aucune énigme onchain active disponible sur Sepolia');
        }
      }
    } catch (error) {
      console.error('\u00c9chec lors de la récupération de l\'\u00e9nigme onchain:', error);
    }
  }
  
  /**
   * Crée une énigme onchain factice pour le développement local
   * Cette méthode est utilisée uniquement en mode local lorsque le contrat n'est pas disponible
   */
  private async createLocalDummyOnchainRiddle() {
    try {
      // Définir un tableau de 3 énigmes avec leurs réponses
      const riddles = [
        {
          text: 'What has keys but no locks, space but no room, and you can enter but not go in?',
          answer: 'keyboard'
        },
        {
          text: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',
          answer: 'echo'
        },
        {
          text: 'The more you take, the more you leave behind. What am I?',
          answer: 'footsteps'
        }
      ];
      
      console.log('Préparation de 3 énigmes pour l\'utilisation onchain');
      
      // Hasher les réponses avec keccak256
      const riddlesWithHash = riddles.map(riddle => {
        // Utiliser ethers.js v6 pour calculer le hash keccak256 de la réponse
        const answerBytes = ethers.toUtf8Bytes(riddle.answer);
        const answerHash = ethers.keccak256(answerBytes);
        
        return {
          ...riddle,
          answerHash
        };
      });
      
      // Afficher les énigmes avec leurs hashs pour référence
      riddlesWithHash.forEach((riddle, index) => {
        console.log(`\u00c9nigme ${index + 1}:`);
        console.log(`- Question: ${riddle.text}`);
        console.log(`- Réponse: ${riddle.answer}`);
        console.log(`- Hash: ${riddle.answerHash}`);
      });
      
      // Utiliser la première énigme pour le contrat et Redis
      const selectedRiddle = riddlesWithHash[0];
      
      // Utiliser le service Ethereum pour définir l'énigme dans le contrat
      const success = await this.ethereumService.setRiddle(
        selectedRiddle.text, 
        selectedRiddle.answerHash, 
        process.env.PRIVATE_KEY
      );
      
      if (success) {
        console.log(`\u00c9nigme "${selectedRiddle.text}" définie avec succès dans le contrat`);
      } else {
        console.warn('Impossible de définir l\'\u00e9nigme dans le contrat, utilisation du mode local');
      }
      
      // Stocker l'énigme dans Redis (que la transaction blockchain ait réussi ou non)
      await this.redisClient.hset(
        'riddle:onchain',
        'id', 'onchain',
        'question', selectedRiddle.text,
        'answer', selectedRiddle.answerHash, 
        'solved', '0',
        'onchain', '1', // Flag pour identifier que c'est une énigme onchain
        'isActive', '1'
      );
      console.log('Énigme onchain factice créée pour le développement local');
    } catch (error) {
      console.error('Échec lors de la création de l\'\u00e9nigme onchain factice:', error);
    }
  }
}
