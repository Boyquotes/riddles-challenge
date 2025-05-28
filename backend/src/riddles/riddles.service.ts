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
  
  // Garder une trace de la dernière énigme proposée pour éviter les répétitions
  private lastProposedRiddleIndex: number | null = null;
  private currentOnchainRiddleIndex: number | null = null;
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
      text: "I add flavor to your dishes and keep your hash safe. What am I?", 
      answer: "salt", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("salt")).substring(2) 
    },
    { 
      text: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", 
      answer: "echo", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("echo")).substring(2) 
    },
    // { 
    //   text: "The more you take, the more you leave behind. What am I?", 
    //   answer: "footsteps", 
    //   hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("footsteps")).substring(2) 
    // },
    // { 
    //   text: "What has a head, a tail, is brown, and has no legs?", 
    //   answer: "penny", 
    //   hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("penny")).substring(2) 
    // },
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
  async onModuleInit() {
    this.logger.log('Initialisation du service Riddles...');
    this.logger.log('Configuration des écouteurs d\'événements...');
    
    // Initialiser le suivi des énigmes utilisées
    this.usedRiddleIndices = new Set<number>();
    this.lastProposedRiddleIndex = null;
    this.currentOnchainRiddleIndex = null;
    
    // Récupérer l'énigme actuelle sur la blockchain pour éviter de la répéter
    try {
      const currentRiddle = await this.ethereumService.getCurrentRiddle();
      if (currentRiddle && currentRiddle.question) {
        this.logger.log(`Énigme actuelle sur la blockchain: "${currentRiddle.question}"`);
        
        // Trouver l'index de l'énigme actuelle dans notre tableau
        const riddleIndex = this.riddlesWithHash.findIndex(r => r.text === currentRiddle.question);
        if (riddleIndex !== -1) {
          this.logger.log(`Index de l'énigme actuelle: ${riddleIndex}`);
          this.currentOnchainRiddleIndex = riddleIndex;
          this.lastProposedRiddleIndex = riddleIndex;
          
          // Ajouter également cet index aux énigmes utilisées
          this.usedRiddleIndices.add(riddleIndex);
          console.log(`Ajout de l'index ${riddleIndex} à la liste des énigmes utilisées`);
          console.log(`Énigmes utilisées après ajout: ${Array.from(this.usedRiddleIndices).join(', ')}`);
          console.log(`Nombre d'énigmes utilisées: ${this.usedRiddleIndices.size}/${this.riddlesWithHash.length}`);
        } else {
          this.logger.warn(`L'énigme actuelle n'a pas été trouvée dans notre tableau d'énigmes`);
        }
      } else {
        this.logger.log('Aucune énigme actuellement définie sur la blockchain');
        
        // Aucune énigme n'est définie sur la blockchain, définir la première énigme
        this.logger.log('Définition de la première énigme sur la blockchain...');
        try {
          // La méthode setRandomRiddleOnchain ajoutera automatiquement l'index de l'énigme à usedRiddleIndices
          const result = await this.setRandomRiddleOnchain();
          if (result) {
            this.logger.log('Première énigme définie avec succès sur la blockchain');
            this.logger.log(`Énigmes utilisées après initialisation: ${Array.from(this.usedRiddleIndices).join(', ')}`);
          } else {
            this.logger.warn('Échec de la définition de la première énigme sur la blockchain');
          }
        } catch (error) {
          this.logger.error('Erreur lors de la définition de la première énigme sur la blockchain:', error);
        }
      }
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'\u00e9nigme actuelle:', error);
    }
    
    this.logger.log('Suivi des énigmes utilisées initialisé');
  }
  
  /**
   * Écouteur d'événement pour définir la prochaine énigme
   * Cet événement est émis par le service Ethereum lorsqu'une réponse correcte est détectée
   */
  @OnEvent('riddle.setNext')
  async handleSetNextRiddle(payload: { timestamp: string; source: string }) {
    this.logger.log(`Événement riddle.setNext reçu depuis ${payload.source} à ${payload.timestamp}`);
    console.log(`=== ÉVÉNEMENT riddle.setNext REÇU ===`);
    console.log(`Source: ${payload.source}`);
    console.log(`Timestamp: ${payload.timestamp}`);
    
    // Vérifier si nous sommes en état de game over
    try {
      // Récupérer l'énigme actuelle
      const currentRiddle = await this.getRiddle('onchain');
      
      // Si l'énigme actuelle est 'game_over', ne pas définir de nouvelle énigme
      if (currentRiddle && currentRiddle.id === 'game_over') {
        console.log('Le jeu est en état de game over, aucune nouvelle énigme ne sera définie automatiquement');
        this.logger.log('Game over: en attente de la réinitialisation manuelle par l\'utilisateur');
        return;
      }
      
      // Définir une énigme aléatoire sur la blockchain
      await this.setRandomRiddleOnchain();
    } catch (error) {
      this.logger.error('Erreur lors de la vérification de l\'\u00e9tat du jeu:', error);
      // En cas d'erreur, essayer quand même de définir une nouvelle énigme
      await this.setRandomRiddleOnchain();
    }
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
      
      // Vérifier si une énigme est déjà active sur la blockchain
      try {
        const currentRiddleInfo = await this.ethereumService.getRiddleWithRetry();
        
        // Vérifier si l'énigme est active et n'a pas encore de gagnant
        // L'adresse du gagnant est l'adresse zéro (0x000...000) quand il n'y a pas de gagnant
        if (currentRiddleInfo.isActive && 
            (currentRiddleInfo.winner === '0x0000000000000000000000000000000000000000' || 
             !currentRiddleInfo.winner || 
             currentRiddleInfo.winner === '0x')) {
          const msg = 'Une énigme est déjà active sur la blockchain et n\'a pas encore été résolue';
          this.logger.log(msg);
          console.log(msg);
          console.log(`Énigme active: "${currentRiddleInfo.question}"`); 
          
          // Trouver l'index de l'énigme active dans notre tableau
          const activeRiddleIndex = this.riddlesWithHash.findIndex(r => r.text === currentRiddleInfo.question);
          
          if (activeRiddleIndex !== -1) {
            // Ajouter l'index de l'énigme active à la liste des énigmes utilisées
            this.usedRiddleIndices.add(activeRiddleIndex);
            this.lastProposedRiddleIndex = activeRiddleIndex;
            this.currentOnchainRiddleIndex = activeRiddleIndex;
            console.log(`Énigme active trouvée à l'index ${activeRiddleIndex}, ajoutée à la liste des énigmes utilisées`);
            console.log(`Énigmes utilisées après ajout: ${Array.from(this.usedRiddleIndices).join(', ')}`);
          } else {
            console.log(`Attention: L'énigme active "${currentRiddleInfo.question}" n'a pas été trouvée dans notre tableau d'énigmes`);
          }
          
          return true; // Retourner true car il n'y a pas d'erreur, c'est juste qu'une énigme est déjà active
        }
      } catch (error) {
        this.logger.warn('Erreur lors de la vérification de l\'\u00e9nigme actuelle, continuation du processus:', error);
      }
      
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
        console.log('Toutes les énigmes ont été utilisées!');
        
        // Récupérer les statistiques des joueurs
        const playerStats = await this.ethereumService.getPlayerStatistics();
        
        // Formater les statistiques pour l'affichage
        let statsMessage = '';
        if (Object.keys(playerStats).length > 0) {
          statsMessage = Object.entries(playerStats)
            .map(([address, wins]) => `${address}: ${wins} victoire${wins > 1 ? 's' : ''}`)
            .join('\n');
        } else {
          statsMessage = 'Aucune statistique disponible';
        }
        
        // Créer le message de game over
        const gameOverMessage = `Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.\n\nStatistiques des joueurs:\n${statsMessage}`;
        
        console.log('=== GAME OVER ===');
        console.log(gameOverMessage);
        
        // Notifier tous les clients connectés que le jeu est terminé
        const gameOverRiddle = {
          id: 'game_over',
          question: gameOverMessage,
          type: 'game_over',
          solved: true,
          onchain: true
        };
        
        // Notifier via Socket.IO
        this.socketService.emitNewRiddle(gameOverRiddle);
        
        // Notifier via GraphQL
        this.pubSub.publish('riddleSolved', { 
          riddleSolved: {
            solvedBy: 'system',
            newRiddle: gameOverRiddle,
          }
        });
        
        // Ne pas réinitialiser la liste des énigmes utilisées ici
        // Nous attendons que l'utilisateur clique sur le bouton de réinitialisation
        console.log('Game over: en attente de la réinitialisation manuelle par l\'utilisateur');
        
        // Retourner true pour indiquer que le traitement s'est bien déroulé
        return true;
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
      // Éviter de sélectionner la même énigme que celle actuellement sur la blockchain
      // ou celle qui vient d'être proposée
      let selectedIndex: number;
      let attempts = 0;
      const maxAttempts = availableIndices.length * 2; // Éviter les boucles infinies
      
      do {
        const randomAvailableIndex = Math.floor(Math.random() * availableIndices.length);
        selectedIndex = availableIndices[randomAvailableIndex];
        attempts++;
        
        // Si nous avons essayé trop de fois ou s'il n'y a qu'une seule énigme disponible, accepter celle-ci
        if (attempts >= maxAttempts || availableIndices.length <= 1) {
          console.log(`Après ${attempts} tentatives, acceptation de l'index ${selectedIndex}`);
          break;
        }
      } while (selectedIndex === this.lastProposedRiddleIndex || selectedIndex === this.currentOnchainRiddleIndex);
      
      console.log(`Index sélectionné après ${attempts} tentatives: ${selectedIndex}`);
      console.log(`Dernière énigme proposée: ${this.lastProposedRiddleIndex}, Énigme actuelle: ${this.currentOnchainRiddleIndex}`);
      
      // Mettre à jour la dernière énigme proposée
      this.lastProposedRiddleIndex = selectedIndex;
      this.currentOnchainRiddleIndex = selectedIndex;
      
      const selectedRiddle = this.riddlesWithHash[selectedIndex];
      
      // Ajouter l'index à la liste des indices utilisés
      this.usedRiddleIndices.add(selectedIndex);
      console.log(`Ajout de l'index ${selectedIndex} à la liste des énigmes utilisées`);
      console.log(`Énigmes utilisées après ajout: ${Array.from(this.usedRiddleIndices).join(', ')}`);
      console.log(`Nombre d'énigmes utilisées: ${this.usedRiddleIndices.size}/${this.riddlesWithHash.length}`);
      
      // Vérifier si nous approchons de la fin du jeu
      if (this.usedRiddleIndices.size === this.riddlesWithHash.length - 1) {
        console.log('Attention: Il ne reste qu\'une seule énigme disponible!');
      }
      
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
          type: 'onchain',
          solved: false,
          onchain: true
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
      const onchainRiddleData = await this.ethereumService.getRiddleWithRetry();
      
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
    try {
      // Get the onchain riddle
      const riddle = await this.getRiddle('onchain');
      
      // If the riddle is solved or doesn't exist, show game over with stats
      if (!riddle || riddle.solved) {
        const stats = await this.getGameOverStats();
        
        return {
          id: 'game_over',
          question: `Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.\n\nStatistiques des joueurs:\n${stats.message}`,
          solved: true,
          answer: 'Merci d\'avoir joué !',
          onchain: true
        };
      }
      
      // Assurons-nous que tous les champs requis sont présents
      return {
        id: riddle.id || 'onchain',
        question: riddle.question || 'Chargement de l\'\u00e9nigme...',
        solved: typeof riddle.solved === 'boolean' ? riddle.solved : false,
        answer: riddle.answer,
        onchain: typeof riddle.onchain === 'boolean' ? riddle.onchain : true
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'\u00e9nigme aléatoire:', error);
      
      // En cas d'erreur, retourner une énigme par défaut
      return {
        id: 'error',
        question: 'Une erreur est survenue lors du chargement de l\'\u00e9nigme. Veuillez réessayer.',
        solved: false,
        answer: undefined,
        onchain: true
      };
    }
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
                    type: 'onchain',
                    solved: false,
                    onchain: true
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
   * Réinitialise le jeu à la première énigme
   * @returns Une promesse qui se résout à true si le jeu a été réinitialisé avec succès, false sinon
   */
  async resetGame(): Promise<boolean> {
    try {
      this.logger.log('Réinitialisation du jeu...');
      
      // Réinitialiser la liste des énigmes utilisées
      this.usedRiddleIndices.clear();
      this.lastProposedRiddleIndex = null;
      this.currentOnchainRiddleIndex = null;
      this.logger.log('Liste des énigmes utilisées réinitialisée');
      
      // Définir la première énigme du tableau sur la blockchain
      const firstRiddleIndex = 0; // Toujours commencer par la première énigme
      const success = await this.setSpecificRiddleOnchain(firstRiddleIndex);
      
      if (success) {
        this.logger.log(`Jeu réinitialisé avec succès! Première énigme définie: "${this.riddlesWithHash[firstRiddleIndex].text}"`);
        
        // Mettre à jour les indices pour éviter de répéter la première énigme immédiatement
        this.lastProposedRiddleIndex = firstRiddleIndex;
        this.currentOnchainRiddleIndex = firstRiddleIndex;
        this.usedRiddleIndices.add(firstRiddleIndex);
        
        // Notifier du succès de la réinitialisation
        this.socketService.emitBlockchainSuccess('Le jeu a été réinitialisé avec succès!');
      } else {
        this.logger.error('Erreur lors de la réinitialisation du jeu');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Erreur lors de la réinitialisation du jeu:', error);
      return false;
    }
  }
}
