import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Riddle } from './models/riddle.model';
import { EthereumService } from '../common/ethereum.service';
import { SocketService } from '../common/socket.service';
import { ethers } from 'ethers';
import { MetaMaskTransaction } from './models/metamask-transaction.model';
import { GameOverStats, PlayerStat } from './models/game-over-stats.model';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../common/constants';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class RiddlesService implements OnModuleInit {
  // Tableau pour suivre les indices des énigmes déjà utilisées
  private usedRiddleIndices: Set<number> = new Set();
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
  
  // Riddles with precomputed keccak256 hashes for easy setting on the blockchain
  private riddlesWithHash: Array<{ text: string; answer: string; hash: string }> = [
    { 
      text: "What has keys but no locks, space but no room, and you can enter but not go in?", 
      answer: "keyboard", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("keyboard")).substring(2) 
    },
    { 
      text: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", 
      answer: "echo", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("echo")).substring(2) 
    },
    { 
      text: "The more you take, the more you leave behind. What am I?", 
      answer: "footsteps", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("footsteps")).substring(2) 
    },
    { 
      text: "What has a head, a tail, is brown, and has no legs?", 
      answer: "penny", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("penny")).substring(2) 
    },
    { 
      text: "What gets wet while drying?", 
      answer: "towel", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("towel")).substring(2) 
    }
  ];

  constructor(
    private readonly ethereumService: EthereumService,
    private readonly socketService: SocketService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly eventEmitter: EventEmitter2
  ) {}
  
  /**
   * Initialisation du module
   * Configuration des écouteurs d'événements
   */
  onModuleInit() {
    this.logger.log('Initialisation du service Riddles...');
    this.logger.log('Configuration des écouteurs d\'événements...');
    
    // Initialiser le suivi des énigmes utilisées
    this.usedRiddleIndices = new Set<number>();
    this.logger.log('Suivi des énigmes utilisées initialisé');
  }
  
  /**
   * Écouteur d'événement pour définir la prochaine énigme
   * Cet événement est émis par le service Ethereum lorsqu'une réponse correcte est détectée
   */
  @OnEvent('riddle.setNext')
  handleSetNextRiddle(payload: { timestamp: string; source: string }) {
    this.logger.log(`Événement riddle.setNext reçu depuis ${payload.source} à ${payload.timestamp}`);
    console.log(`=== ÉVÉNEMENT riddle.setNext REÇU ===`);
    console.log(`Source: ${payload.source}`);
    console.log(`Timestamp: ${payload.timestamp}`);
    
    // Définir une énigme aléatoire sur la blockchain
    this.setRandomRiddleOnchain();
  }
  
  /**
   * Définit une énigme aléatoire sur la blockchain
   * Sélectionne une énigme au hasard parmi celles disponibles qui n'ont pas encore été jouées
   * @returns Une promesse qui se résout à true si l'énigme a été définie avec succès, false sinon
   */
  async setRandomRiddleOnchain(): Promise<boolean> {
    try {
      console.log('=== DÉBUT DE LA MÉTHODE setRandomRiddleOnchain ===');
      console.log(`Énigmes déjà utilisées: ${Array.from(this.usedRiddleIndices).join(', ')}`);
      
      // Vérifier si nous avons une clé privée pour signer la transaction
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        const errorMsg = 'Aucune clé privée disponible pour définir une énigme aléatoire';
        this.logger.error(errorMsg);
        console.error(errorMsg);
        this.socketService.emitBlockchainError(errorMsg);
        return false;
      }
      
      // Vérifier si toutes les énigmes ont été utilisées
      if (this.usedRiddleIndices.size >= this.riddlesWithHash.length) {
        console.log('Toutes les énigmes ont été utilisées, réinitialisation de la liste');
        this.usedRiddleIndices.clear();
      }
      
      // Créer un tableau des indices d'énigmes non utilisées
      const availableIndices = Array.from(
        { length: this.riddlesWithHash.length },
        (_, i) => i
      ).filter(index => !this.usedRiddleIndices.has(index));
      
      console.log(`Indices disponibles: ${availableIndices.join(', ')}`);
      
      if (availableIndices.length === 0) {
        const errorMsg = 'Aucune énigme disponible (toutes ont été utilisées)';
        this.logger.error(errorMsg);
        console.error(errorMsg);
        this.socketService.emitBlockchainError(errorMsg);
        return false;
      }
      
      // Sélectionner un index aléatoire parmi les indices disponibles
      const randomAvailableIndex = Math.floor(Math.random() * availableIndices.length);
      const selectedIndex = availableIndices[randomAvailableIndex];
      const selectedRiddle = this.riddlesWithHash[selectedIndex];
      
      // Ajouter l'index à la liste des indices utilisés
      this.usedRiddleIndices.add(selectedIndex);
      console.log(`Ajout de l'index ${selectedIndex} à la liste des énigmes utilisées`);
      
      console.log(`Énigme aléatoire sélectionnée: index=${selectedIndex}`);
      console.log(`Texte: "${selectedRiddle.text}"`);
      console.log(`Réponse: "${selectedRiddle.answer}"`);
      console.log(`Hash: ${selectedRiddle.hash}`);
      
      // Définir l'énigme sur la blockchain
      console.log('Appel du service Ethereum pour définir l\'énigme...');
      const success = await this.ethereumService.setRiddle(
        selectedRiddle.text,
        selectedRiddle.hash,
        privateKey
      );
      
      if (success) {
        const successMsg = `Énigme aléatoire #${selectedIndex} définie avec succès sur la blockchain`;
        this.logger.log(successMsg);
        console.log(successMsg);
        
        // Créer un objet riddle pour notifier les clients
        const newRiddle = {
          id: 'onchain',
          question: selectedRiddle.text,
          type: 'onchain'
        };
        
        // Notifier tous les clients connectés de la nouvelle énigme
        console.log('Notification des clients via Socket.IO...');
        this.socketService.emitNewRiddle(newRiddle);
        
        // Notifier également via GraphQL
        console.log('Publication via PubSub pour GraphQL...');
        this.pubSub.publish('riddleSolved', { 
          riddleSolved: {
            solvedBy: 'system',
            newRiddle,
          }
        });
        
        console.log('=== FIN DE LA MÉTHODE setRandomRiddleOnchain (SUCCÈS) ===');
        return true;
      } else {
        const errorMsg = `Échec de la définition de l'énigme aléatoire #${selectedIndex}`;
        this.logger.error(errorMsg);
        console.error(errorMsg);
        this.socketService.emitBlockchainError(errorMsg);
        console.log('=== FIN DE LA MÉTHODE setRandomRiddleOnchain (ÉCHEC) ===');
        return false;
      }
    } catch (error) {
      this.logger.error('Erreur lors de la définition d\'une énigme aléatoire:', error);
      console.error('=== ERREUR DANS LA MÉTHODE setRandomRiddleOnchain ===');
      console.error(`Message d'erreur: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
      this.socketService.emitBlockchainError(`Erreur lors de la définition d'une énigme aléatoire: ${error.message}`);
      return false;
    }
  }

  async getRiddle(id: string): Promise<Riddle> {
    // Only support onchain riddle
    if (id !== 'onchain') {
      return null;
    }
    
    try {
      const onchainRiddleData = await this.ethereumService.getRiddle();
      
      return {
        id: 'onchain',
        question: onchainRiddleData.question,
        solved: onchainRiddleData.winner !== '0x0000000000000000000000000000000000000000',
        answer: undefined, // We don't know the answer, it's stored as a hash in the contract
        onchain: true
      };
    } catch (error) {
      this.logger.error('Error fetching onchain riddle:', error);
      return null;
    }
  }

  async getAllRiddles(): Promise<Riddle[]> {
    // Only return the onchain riddle
    const riddle = await this.getRiddle('onchain');
    return riddle ? [riddle] : [];
  }

  async getRandomRiddle(): Promise<Riddle> {
    // Get the onchain riddle
    const riddle = await this.getRiddle('onchain');
    
    // If the riddle is solved or doesn't exist, show game over with stats
    if (!riddle || riddle.solved) {
      const stats = await this.getGameOverStats();
      
      return {
        id: 'game_over',
        question: `Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.\n\nStatistiques des joueurs:\n${stats.message}`,
        solved: true,
        answer: 'Merci d\'avoir joué !'
      };
    }
    
    return riddle;
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
    // Only support onchain riddle
    if (id !== 'onchain') {
      return false;
    }

    return this.checkOnchainAnswer(answer);
  }

  async checkOnchainAnswer(answer: string): Promise<boolean> {
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
        this.logger.log('Onchain riddle solved correctly!');
        
        // Planifier la définition de la prochaine énigme après un délai de 4 secondes
        this.scheduleNextRiddle();
      }
      
      return isCorrect;
    } catch (error) {
      this.logger.error('Error checking onchain answer:', error);
      return false;
    }
  }
  
  /**
   * Planifie la définition de la prochaine énigme après un délai de 4 secondes
   * Cela permet aux joueurs de voir le message de succès avant que la nouvelle énigme ne soit définie
   */
  private scheduleNextRiddle(): void {
    console.log('=== DÉBUT DE LA PLANIFICATION DE LA PROCHAINE ÉNIGME ===');
    
    // Vérifier si nous avons une clé privée pour signer la transaction
    const privateKey = process.env.PRIVATE_KEY;
    console.log(`Clé privée disponible: ${privateKey ? 'Oui (masquée)' : 'Non'}`);
    
    if (!privateKey) {
      const errorMsg = 'Aucune clé privée disponible pour planifier la prochaine énigme';
      this.logger.warn(errorMsg);
      console.warn(errorMsg);
      // Notifier les clients de l'erreur
      this.socketService.emitBlockchainError('Impossible de définir la prochaine énigme: clé privée manquante');
      return;
    }
    
    // Vérifier le mode réseau et autres paramètres de configuration
    const networkMode = process.env.NETWORK_MODE || 'testnet';
    const contractAddress = process.env.CONTRACT_ADDRESS || 'non défini';
    const chainId = process.env.ACTIVE_CHAIN_ID || 'non défini';
    
    console.log('=== CONFIGURATION POUR LA PLANIFICATION ===');
    console.log(`Mode réseau: ${networkMode}`);
    console.log(`Adresse du contrat: ${contractAddress}`);
    console.log(`Chain ID: ${chainId}`);
    console.log(`Nombre d'énigmes disponibles: ${this.riddlesWithHash.length}`);
    
    // Vérifier si nous avons des énigmes disponibles
    if (this.riddlesWithHash.length === 0) {
      const errorMsg = 'Aucune énigme disponible pour la planification';
      this.logger.error(errorMsg);
      console.error(errorMsg);
      this.socketService.emitBlockchainError(errorMsg);
      return;
    }
    
    this.logger.log(`Planification de la prochaine énigme dans 4 secondes... (Mode réseau: ${networkMode})`);
    console.log(`Début du compte à rebours de 4 secondes avant de définir la nouvelle énigme...`);
    
    // Utiliser setTimeout pour définir la prochaine énigme après 4 secondes
    const timerId = setTimeout(async () => {
      console.log('=== DÉLAI DE 4 SECONDES ÉCOULÉ, DÉFINITION DE LA NOUVELLE ÉNIGME ===');
      try {
        // Calculer l'index de la prochaine énigme (aléatoire ou séquentiel)
        // Ici nous choisissons un index aléatoire pour plus de variété
        const nextIndex = Math.floor(Math.random() * this.riddlesWithHash.length);
        
        const logMsg = `Définition automatique de l'énigme #${nextIndex} après délai...`;
        this.logger.log(logMsg);
        console.log(logMsg);
        
        // Récupérer l'énigme spécifique
        const selectedRiddle = this.riddlesWithHash[nextIndex];
        console.log('=== DÉTAILS DE L\'ÉNIGME SÉLECTIONNÉE ===');
        console.log(`Index: ${nextIndex}`);
        console.log(`Texte: "${selectedRiddle.text}"`);
        console.log(`Réponse: "${selectedRiddle.answer}"`);
        console.log(`Hash: ${selectedRiddle.hash}`);
        
        this.logger.log(`Énigme sélectionnée: "${selectedRiddle.text}", Réponse: "${selectedRiddle.answer}", Hash: ${selectedRiddle.hash}`);
        
        console.log('Appel du service Ethereum pour définir l\'énigme dans la blockchain...');
        
        // Définir directement l'énigme dans la blockchain sans passer par setSpecificRiddleOnchain
        // pour éviter les problèmes potentiels
        const success = await this.ethereumService.setRiddle(
          selectedRiddle.text, 
          selectedRiddle.hash, 
          privateKey
        );
        
        console.log(`Résultat de l'opération setRiddle: ${success ? 'SUCCÈS' : 'ÉCHEC'}`);
        
        if (success) {
          const successMsg = `Énigme #${nextIndex} définie automatiquement avec succès après résolution!`;
          this.logger.log(successMsg);
          console.log(successMsg);
          
          // Créer un objet riddle pour notifier les clients
          const newRiddle = {
            id: 'onchain',
            question: selectedRiddle.text
          };
          
          console.log('Notification de tous les clients connectés via Socket.IO...');
          // Notifier tous les clients connectés de la nouvelle énigme
          this.socketService.emitNewRiddle(newRiddle);
          
          console.log('Notification de succès envoyée aux clients');
          // Notifier également du succès de l'opération
          this.socketService.emitBlockchainSuccess('Nouvelle énigme définie automatiquement avec succès!');
          
          // Notification de la nouvelle énigme via le PubSub pour GraphQL
          console.log('Publication de la nouvelle énigme via PubSub pour GraphQL...');
          try {
            // Vérifier si le service a accès au PubSub
            if (this.pubSub) {
              this.pubSub.publish('riddleSolved', { 
                riddleSolved: {
                  solvedBy: 'system',
                  newRiddle: {
                    id: 'onchain',
                    question: selectedRiddle.text,
                    type: 'onchain'
                  },
                }
              });
              console.log('Publication PubSub réussie!');
            } else {
              console.warn('PubSub non disponible dans le service Riddles!');
            }
          } catch (pubSubError) {
            console.error('Erreur lors de la publication via PubSub:', pubSubError);
          }
          console.log('Notification complète de tous les clients terminée');
        } else {
          const errorMsg = `Échec de la définition automatique de l'énigme #${nextIndex}`;
          this.logger.error(errorMsg);
          console.error(errorMsg);
          this.socketService.emitBlockchainError(errorMsg);
        }
      } catch (error) {
        this.logger.error('Erreur lors de la définition automatique de la prochaine énigme:', error);
        console.error('=== ERREUR LORS DE LA DÉFINITION AUTOMATIQUE DE LA PROCHAINE ÉNIGME ===');
        console.error(`Message d'erreur: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        this.socketService.emitBlockchainError(`Erreur lors de la définition automatique de la prochaine énigme: ${error.message}`);
      } finally {
        console.log('=== FIN DE LA PLANIFICATION DE LA PROCHAINE ÉNIGME ===');
      }
    }, 4000); // 4 secondes de délai
    
    console.log(`Timer ID pour la planification: ${timerId}`);
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
      }
      
      return success;
    } catch (error) {
      this.logger.error('Erreur lors de la définition de la prochaine énigme dans la blockchain:', error);
      return false;
    }
  }
  
  /**
   * Définit une énigme spécifique dans la blockchain par son index dans le tableau riddlesWithHash
   * @param index L'index de l'énigme à définir dans le tableau riddlesWithHash
   * @returns true si l'énigme a été définie avec succès, false sinon
   */
  async setSpecificRiddleOnchain(index: number): Promise<boolean> {
    try {
      this.logger.log(`Tentative de définition de l'énigme #${index} dans la blockchain...`);
      
      // Vérifier si l'index est valide
      if (index < 0 || index >= this.riddlesWithHash.length) {
        this.logger.error(`Index d'énigme invalide: ${index}. Doit être entre 0 et ${this.riddlesWithHash.length - 1}`);
        return false;
      }
      
      // Vérifier si nous avons une clé privée pour signer la transaction
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        this.logger.warn('Aucune clé privée disponible pour définir l\'énigme');
        return false;
      }
      
      // Récupérer l'énigme spécifique
      const selectedRiddle = this.riddlesWithHash[index];
      
      // Définir l'énigme dans la blockchain en utilisant directement le hash précompilé
      const success = await this.ethereumService.setRiddle(
        selectedRiddle.text, 
        selectedRiddle.hash, 
        privateKey
      );
      
      if (success) {
        this.logger.log(`Énigme #${index} "${selectedRiddle.text}" définie avec succès dans la blockchain`);
        this.logger.log(`Réponse: "${selectedRiddle.answer}", Hash: ${selectedRiddle.hash}`);
        
        // Créer un objet riddle pour notifier les clients
        const newRiddle = {
          id: 'onchain',
          question: selectedRiddle.text
        };
        
        // Notifier tous les clients connectés de la nouvelle énigme
        this.socketService.emitNewRiddle(newRiddle);
        
        // Notifier également du succès de l'opération
        this.socketService.emitBlockchainSuccess('Nouvelle énigme définie avec succès sur la blockchain!');
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Erreur lors de la définition de l'énigme #${index} dans la blockchain:`, error);
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
  
  /**
   * Réinitialise le jeu en définissant la première énigme du tableau riddlesWithHash
   * @returns true si la réinitialisation a réussi, false sinon
   */
  async resetGame(): Promise<boolean> {
    try {
      this.logger.log('Réinitialisation du jeu avec la première énigme...');
      
      // Utiliser la méthode existante pour définir la première énigme (index 0)
      const success = await this.setSpecificRiddleOnchain(0);
      
      if (success) {
        this.logger.log('Jeu réinitialisé avec succès!');
        
        // Notifier du succès de la réinitialisation
        this.socketService.emitBlockchainSuccess('Le jeu a été réinitialisé avec succès!');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Erreur lors de la réinitialisation du jeu:', error);
      return false;
    }
  }
}
