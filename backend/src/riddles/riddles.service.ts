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
  
  // Ensemble pour stocker les énigmes déjà résolues dans cette partie
  private solvedRiddles: Set<string> = new Set();
  
  // Statistiques de jeu
  private gameStats = {
    totalRiddlesSolved: 0,
    onchainRiddlesSolved: 0,
    localRiddlesSolved: 0,
    startTime: new Date(),
    lastSolvedTime: null as Date | null,
    playerStats: new Map<string, { victories: number, lastVictory: Date }>(),
  };
  
  // Garder une trace de la dernière énigme proposée pour éviter les répétitions
  private lastProposedRiddleIndex: number | null = null;
  private currentOnchainRiddleIndex: number | null = null;
  private readonly logger = new Logger(RiddlesService.name);
  private availableRiddles: Array<{ text: string; answer: string }> = [
    { text: "What has keys but no locks, space but no room, and you can enter but not go in?", answer: "keyboard" },
    { text: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo" }
  ];
  
  // Riddles with precomputed keccak256 hashes for easy setting on the blockchain
  private riddlesWithHash: Array<{ text: string; answer: string; hash: string }> = [
    { 
      text: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", 
      answer: "echo", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("echo")).substring(2) 
    },
    { 
      text: "What has a head, a tail, is brown, and has no legs?", 
      answer: "penny", 
      hash: "0x" + ethers.keccak256(ethers.toUtf8Bytes("penny")).substring(2) 
    }
  ];

  constructor(
    private ethereumService: EthereumService,
    private socketService: SocketService,
    @Inject(PUB_SUB) private pubSub: PubSub,
    private eventEmitter: EventEmitter2
  ) {
    // S'abonner à l'événement riddle.setNext
    this.eventEmitter.on('riddle.setNext', (payload) => {
      console.log('=== ÉVÉNEMENT riddle.setNext REÇU ===');
      console.log('Payload:', payload);
      this.logger.log(`Événement riddle.setNext reçu de ${payload.source}`);
      
      // Appeler scheduleNextRiddle pour définir la prochaine énigme
      this.scheduleNextRiddle();
    });
    
    this.logger.log('Écouteur d\'événement riddle.setNext configuré');
  }

  async onModuleInit() {
    this.logger.log('RiddlesService initialized');
    
    // Réinitialiser les énigmes résolues et les statistiques
    this.solvedRiddles.clear();
    this.gameStats = {
      totalRiddlesSolved: 0,
      onchainRiddlesSolved: 0,
      localRiddlesSolved: 0,
      startTime: new Date(),
      lastSolvedTime: null,
      playerStats: new Map<string, { victories: number, lastVictory: Date }>(),
    };
    
    this.logger.log('Tableau des énigmes résolues effacé et statistiques réinitialisées');
    
    // Initialiser le jeu au démarrage
    try {
      // Définir une nouvelle énigme
      await this.resetGame();
      this.logger.log('Game initialized successfully');
      
      // Envoyer un message à tous les joueurs pour informer du démarrage d'une nouvelle partie
      this.socketService.emitBlockchainSuccess('Nouvelle partie démarrée! Une nouvelle énigme a été définie.');
    } catch (error) {
      this.logger.error('Failed to initialize game:', error);
    }
  }

  /**
   * Récupère une énigme spécifique par son ID
   * @param id Identifiant de l'énigme
   * @returns L'énigme correspondante ou null si non trouvée
   */
  async getRiddle(id: string): Promise<Riddle> {
    try {
      // Si c'est une énigme onchain
      if (id === 'onchain') {
        const onchainRiddle = await this.ethereumService.getCurrentRiddle();
        
        if (onchainRiddle && onchainRiddle.question) {
          return {
            id: 'onchain',
            question: onchainRiddle.question,
            solved: false,
            onchain: true
          };
        }
        
        // Si pas d'énigme onchain disponible
        return {
          id: 'error',
          question: 'Aucune énigme onchain disponible actuellement.',
          solved: false,
          onchain: false
        };
      }
      
      // Sinon, c'est une énigme locale
      const riddleIndex = parseInt(id);
      if (isNaN(riddleIndex) || riddleIndex < 0 || riddleIndex >= this.availableRiddles.length) {
        this.logger.error(`Identifiant d'énigme invalide: ${id}`);
        return {
          id: 'error',
          question: 'Énigme non trouvée.',
          solved: false,
          onchain: false
        };
      }
      
      const selectedRiddle = this.availableRiddles[riddleIndex];
      return {
        id: riddleIndex.toString(),
        question: selectedRiddle.text,
        solved: this.usedRiddleIndices.has(riddleIndex),
        onchain: false
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de l'énigme ${id}:`, error);
      return {
        id: 'error',
        question: 'Erreur lors de la récupération de l\'énigme.',
        solved: false,
        onchain: false
      };
    }
  }
  
  /**
   * Récupère toutes les énigmes disponibles
   * @returns Liste de toutes les énigmes
   */
  async getAllRiddles(): Promise<Riddle[]> {
    try {
      // Récupérer l'énigme onchain si disponible
      const onchainRiddle = await this.ethereumService.getCurrentRiddle();
      const riddles: Riddle[] = [];
      
      // Ajouter l'énigme onchain si disponible
      if (onchainRiddle && onchainRiddle.question) {
        riddles.push({
          id: 'onchain',
          question: onchainRiddle.question,
          solved: false,
          onchain: true
        });
      }
      
      // Ajouter les énigmes locales
      this.availableRiddles.forEach((riddle, index) => {
        riddles.push({
          id: index.toString(),
          question: riddle.text,
          solved: this.usedRiddleIndices.has(index),
          onchain: false
        });
      });
      
      return riddles;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de toutes les énigmes:', error);
      return [];
    }
  }
  
  /**
   * Récupère une énigme aléatoire
   * @returns Une énigme aléatoire ou un message de fin de jeu si toutes les énigmes sont résolues
   */
  async getRandomRiddle(): Promise<Riddle> {
    try {
      // Vérifier si toutes les énigmes ont été résolues
      const allRiddlesSolved = await this.checkAllRiddlesSolved();
      if (allRiddlesSolved) {
        this.logger.log('Toutes les énigmes ont été résolues. Affichage du message de fin de jeu.');
        return {
          id: 'game_over',
          question: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.',
          solved: true,
          onchain: false
        };
      }
      
      // Vérifier si une énigme onchain est disponible
      const onchainRiddle = await this.ethereumService.getCurrentRiddle();
      
      // if (onchainRiddle && onchainRiddle.question) {
      //   // Vérifier si cette énigme a déjà été résolue
      //   if (this.solvedRiddles.has('onchain')) {
      //     this.logger.log('L\'énigme onchain a déjà été résolue. Sélection d\'une énigme locale.');
      //   } else {
      //     this.logger.log(`Énigme onchain trouvée: "${onchainRiddle.question}"`);
      //     return {
      //       id: 'onchain',
      //       question: onchainRiddle.question,
      //       solved: false,
      //       onchain: true
      //     };
      //   }
      // }
      
      // Si pas d'énigme onchain disponible ou si elle a déjà été résolue, sélectionner une énigme locale
      // Vérifier s'il reste des énigmes locales non résolues
      const availableIndices = [];
      for (let i = 0; i < this.availableRiddles.length; i++) {
        if (!this.solvedRiddles.has(i.toString())) {
          availableIndices.push(i);
        }
      }
      
      if (availableIndices.length === 0) {
        this.logger.log('Toutes les énigmes locales ont été résolues. Affichage du message de fin de jeu.');
        return {
          id: 'game_over',
          question: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.',
          solved: true,
          onchain: false
        };
      }
      
      // Sélectionner une énigme aléatoire parmi celles qui n'ont pas encore été résolues
      // Éviter de répéter la dernière énigme proposée si possible
      let randomIndex: number;
      
      // Vérifier si nous avons encore des énigmes disponibles
      if (availableIndices.length === 0) {
        // Si toutes les énigmes ont été résolues, retourner le message de fin de jeu
        this.logger.log('Toutes les énigmes ont été résolues, affichage du message de fin de jeu');
        return {
          id: 'game_over',
          question: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.',
          solved: true,
          onchain: false
        };
      }
      
      // Filtrer les indices disponibles pour exclure la dernière énigme proposée
      const filteredIndices = availableIndices.filter(index => index !== this.lastProposedRiddleIndex);
      
      if (filteredIndices.length > 0) {
        // S'il reste des énigmes autres que la dernière proposée, en choisir une au hasard
        randomIndex = filteredIndices[Math.floor(Math.random() * filteredIndices.length)];
        this.logger.log(`Sélection d'une nouvelle énigme différente de la précédente (index ${this.lastProposedRiddleIndex})`);
      } else {
        // S'il ne reste qu'une seule énigme disponible (qui est la dernière proposée), l'utiliser quand même
        randomIndex = availableIndices[0];
        this.logger.log(`Une seule énigme disponible (index ${randomIndex}), réutilisation de celle-ci`);
      }
      
      // Marquer cette énigme comme utilisée
      this.usedRiddleIndices.add(randomIndex);
      this.lastProposedRiddleIndex = randomIndex;
      
      const selectedRiddle = this.availableRiddles[randomIndex];
      this.logger.log(`Énigme locale sélectionnée: "${selectedRiddle.text}"`);
      
      return {
        id: randomIndex.toString(),
        question: selectedRiddle.text,
        solved: false,
        onchain: false
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération d\'une énigme aléatoire:', error);
      return {
        id: 'error',
        question: 'Désolé, une erreur est survenue lors de la récupération de l\'énigme. Veuillez réessayer.',
        solved: false,
        onchain: false
      };
    }
  }

  /**
   * Vérifie si la réponse à l'énigme est correcte
   * @param riddleId Identifiant de l'énigme
   * @param answer Réponse proposée
   * @param playerId Identifiant du joueur (optionnel)
   * @returns Vrai si la réponse est correcte, faux sinon
   */
  async checkAnswer(riddleId: string, answer: string, playerId?: string): Promise<boolean> {
    try {
      // Vérifier si l'énigme a déjà été résolue
      if (this.solvedRiddles.has(riddleId)) {
        this.logger.log(`L'énigme ${riddleId} a déjà été résolue`);
        // On peut quand même vérifier si la réponse est correcte, mais sans mettre à jour les statistiques
      }
      
      // Normaliser la réponse (minuscules, sans espaces)
      const normalizedAnswer = answer.toLowerCase().trim();
      
      // Vérifier si c'est une énigme onchain
      if (riddleId === 'onchain') {
        this.logger.log(`Vérification de la réponse onchain: "${normalizedAnswer}"`);
        const isCorrect = await this.ethereumService.checkAnswer(normalizedAnswer);
        
        if (isCorrect && !this.solvedRiddles.has(riddleId)) {
          this.logger.log('Réponse onchain correcte!');
          
          // Mettre à jour les statistiques
          this.gameStats.totalRiddlesSolved++;
          this.gameStats.onchainRiddlesSolved++;
          this.gameStats.lastSolvedTime = new Date();
          this.solvedRiddles.add(riddleId);
          
          // Mettre à jour les statistiques du joueur si un ID est fourni
          if (playerId) {
            const playerStats = this.gameStats.playerStats.get(playerId) || { victories: 0, lastVictory: new Date() };
            playerStats.victories++;
            playerStats.lastVictory = new Date();
            this.gameStats.playerStats.set(playerId, playerStats);
          }
          
          // Publier l'événement de résolution d'énigme
          await this.pubSub.publish('riddleSolved', { 
            riddleSolved: { 
              id: riddleId,
              onchain: true
            } 
          });
          
          // Vérifier si toutes les énigmes ont été résolues
          const allRiddlesSolved = await this.checkAllRiddlesSolved();
          
          if (!allRiddlesSolved) {
            // Planifier la prochaine énigme seulement si toutes les énigmes n'ont pas été résolues
            this.scheduleNextRiddle();
          }
        }
        
        return isCorrect;
      }
      
      // Sinon, c'est une énigme locale
      const riddleIndex = parseInt(riddleId);
      if (isNaN(riddleIndex) || riddleIndex < 0 || riddleIndex >= this.availableRiddles.length) {
        this.logger.error(`Identifiant d'énigme invalide: ${riddleId}`);
        return false;
      }
      
      const correctAnswer = this.availableRiddles[riddleIndex].answer.toLowerCase().trim();
      const isCorrect = normalizedAnswer === correctAnswer;
      
      if (isCorrect && !this.solvedRiddles.has(riddleId)) {
        this.logger.log(`Réponse correcte pour l'énigme ${riddleId}!`);
        
        // Mettre à jour les statistiques
        this.gameStats.totalRiddlesSolved++;
        this.gameStats.localRiddlesSolved++;
        this.gameStats.lastSolvedTime = new Date();
        this.solvedRiddles.add(riddleId);
        
        // Mettre à jour les statistiques du joueur si un ID est fourni
        if (playerId) {
          const playerStats = this.gameStats.playerStats.get(playerId) || { victories: 0, lastVictory: new Date() };
          playerStats.victories++;
          playerStats.lastVictory = new Date();
          this.gameStats.playerStats.set(playerId, playerStats);
        }
        
        // Publier l'événement de résolution d'énigme
        await this.pubSub.publish('riddleSolved', { 
          riddleSolved: { 
            id: riddleId,
            onchain: false
          } 
        });
        
        // Vérifier si toutes les énigmes ont été résolues
        await this.checkAllRiddlesSolved();
      }
      
      return isCorrect;
    } catch (error) {
      this.logger.error('Erreur lors de la vérification de la réponse:', error);
      return false;
    }
  }

  /**
   * Vérifie si toutes les énigmes ont été résolues
   * Si c'est le cas, affiche un message de fin de jeu avec les statistiques
   * @returns true si toutes les énigmes ont été résolues, false sinon
   */
  async checkAllRiddlesSolved(): Promise<boolean> {
    // Compter le nombre total d'énigmes disponibles (locales + onchain)
    const totalLocalRiddles = this.availableRiddles.length;
    console.log('Total d\'énigmes locales:', totalLocalRiddles);
    const totalOnchainRiddles = this.riddlesWithHash.length;
    console.log('Total d\'énigmes onchain:', totalOnchainRiddles);
    console.log('Total d\'énigmes résolues:', this.solvedRiddles.size);
    // Vérifier si toutes les énigmes ont été résolues
    const allRiddlesSolved = this.solvedRiddles.size >= totalOnchainRiddles;
    
    if (allRiddlesSolved) {
      this.logger.log('Toutes les énigmes ont été résolues! Fin du jeu.');
      
      // Calculer le temps total de jeu
      const gameEndTime = new Date();
      const gameDurationMs = gameEndTime.getTime() - this.gameStats.startTime.getTime();
      const gameDurationMinutes = Math.floor(gameDurationMs / 60000);
      const gameDurationSeconds = Math.floor((gameDurationMs % 60000) / 1000);
      
      // Préparer les statistiques de fin de jeu
      const stats = await this.getGameOverStats();
      
      // Ajouter des statistiques supplémentaires
      const gameOverMessage = {
        message: `Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.\n\n` +
                `Durée totale: ${gameDurationMinutes}m ${gameDurationSeconds}s\n` +
                `Total d'énigmes résolues: ${this.gameStats.totalRiddlesSolved}\n` +
                `Énigmes onchain résolues: ${this.gameStats.onchainRiddlesSolved}\n` +
                `Énigmes locales résolues: ${this.gameStats.localRiddlesSolved}\n\n` +
                `Classement des joueurs:\n${stats.message}`,
        stats: this.gameStats,
        playerStats: stats.playerStats
      };
      
      // Publier l'événement de fin de jeu
      await this.pubSub.publish('gameOver', { gameOver: gameOverMessage });
      
      // Envoyer le message de fin de jeu à tous les joueurs via Socket.IO
      console.log('Envoi du message de fin de jeu à tous les joueurs via Socket.IO...');
      this.socketService.emitBlockchainSuccess('Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.');
      
      // Envoyer également un message spécial pour le game over
      if (this.socketService.getSocketServer()) {
        this.socketService.getSocketServer().emit('gameOver', gameOverMessage);
        console.log('Message de game over envoyé via Socket.IO');
      }
      
      return true;
    }
    
    return false;
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
   * @param address Adresse Ethereum complète
   * @returns Adresse formatée (début...fin)
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Prépare une transaction pour MetaMask
   * @param answer Réponse à l'énigme
   * @returns Données de transaction pour MetaMask
   */
  async prepareMetaMaskTransaction(answer: string): Promise<MetaMaskTransaction> {
    try {
      const normalizedAnswer = answer.toLowerCase().trim();
      return await this.ethereumService.prepareMetaMaskTransaction(normalizedAnswer);
    } catch (error) {
      this.logger.error('Erreur lors de la préparation de la transaction MetaMask:', error);
      throw error;
    }
  }

  /**
   * Planifie la définition de la prochaine énigme
   * Attend 2 secondes avant de définir une nouvelle énigme
   */
  private scheduleNextRiddle(): void {
    console.log('=== DÉBUT DE LA PLANIFICATION DE LA PROCHAINE ÉNIGME ===');
    
    // Vérifier si nous avons une clé privée pour signer la transaction
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.log('Aucune clé privée configurée. Impossible de définir une nouvelle énigme automatiquement.');
      return;
    }
    
    // Attendre 2 secondes avant de définir la nouvelle énigme
    // Cela donne le temps à la transaction précédente d'être confirmée
    const timerId = setTimeout(async () => {
      console.log('=== DÉLAI DE 2 SECONDES ÉCOULÉ, DÉFINITION DE LA NOUVELLE ÉNIGME ===');
      try {
        // Calculer l'index de la prochaine énigme (aléatoire ou séquentiel)
        // Ici nous choisissons un index aléatoire pour plus de variété
        let nextRiddleIndex;
        
        // Éviter de répéter la même énigme onchain si possible
        if (this.riddlesWithHash.length > 1 && this.currentOnchainRiddleIndex !== null) {
          // Créer un tableau d'indices disponibles en excluant l'index actuel
          const availableIndices = Array.from(
            { length: this.riddlesWithHash.length },
            (_, i) => i
          ).filter(index => index !== this.currentOnchainRiddleIndex);
          
          // Sélectionner un index aléatoire parmi les disponibles
          nextRiddleIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
          
          this.logger.log(`Sélection d'une nouvelle énigme onchain différente de la précédente (index ${this.currentOnchainRiddleIndex})`);
        } else {
          // Si c'est la première énigme ou s'il n'y a qu'une seule énigme disponible
          nextRiddleIndex = Math.floor(Math.random() * this.riddlesWithHash.length);
          
          if (this.currentOnchainRiddleIndex !== null) {
            this.logger.log(`Une seule énigme onchain disponible, réutilisation de l'index ${nextRiddleIndex}`);
          } else {
            this.logger.log(`Première énigme onchain, sélection de l'index ${nextRiddleIndex}`);
          }
        }
        
        // Définir la nouvelle énigme sur la blockchain
        const success = await this.setSpecificRiddleOnchain(nextRiddleIndex);
        
        if (success) {
          console.log(`=== NOUVELLE ÉNIGME DÉFINIE AVEC SUCCÈS: "${this.riddlesWithHash[nextRiddleIndex].text}" ===`);
          
          // Mettre à jour l'index de l'énigme onchain actuelle
          this.currentOnchainRiddleIndex = nextRiddleIndex;
          
          // Créer l'objet de la nouvelle énigme
          const newRiddle = {
            id: 'onchain',
            question: this.riddlesWithHash[nextRiddleIndex].text,
            solved: false,
            onchain: true
          };
          
          // Publier l'événement de nouvelle énigme via GraphQL
          await this.pubSub.publish('newRiddle', { 
            newRiddle: newRiddle
          });
          
          // Envoyer la nouvelle énigme à tous les joueurs via Socket.IO
          console.log('Envoi de la nouvelle énigme à tous les joueurs via Socket.IO...');
          this.socketService.emitNewRiddle({
            id: newRiddle.id,
            question: newRiddle.question
          });
          console.log('Nouvelle énigme envoyée avec succès via Socket.IO');
        } else {
          console.error('=== ÉCHEC DE LA DÉFINITION DE LA NOUVELLE ÉNIGME ===');
        }
      } catch (error) {
        console.error('=== ERREUR LORS DE LA DÉFINITION DE LA NOUVELLE ÉNIGME ===', error);
      }
    }, 1000);
    
    console.log(`Timer ID pour la planification: ${timerId}`);
  }
  
  /**
   * Définit la prochaine énigme dans la blockchain lorsqu'une énigme est résolue
   * Sélectionne une énigme aléatoire parmi celles disponibles
   */
  async setSpecificRiddleOnchain(riddleIndex: number): Promise<boolean> {
    try {
      if (riddleIndex < 0 || riddleIndex >= this.riddlesWithHash.length) {
        this.logger.error(`Index d'énigme invalide: ${riddleIndex}`);
        return false;
      }
      
      const riddle = this.riddlesWithHash[riddleIndex];
      this.logger.log(`Définition de l'énigme sur la blockchain: "${riddle.text}"`);
      
      // Définir l'énigme sur la blockchain en utilisant setNextRiddle
      const success = await this.ethereumService.setNextRiddle([{ text: riddle.text, answer: riddle.answer }]);
      
      if (success) {
        this.logger.log(`Énigme définie avec succès sur la blockchain: "${riddle.text}"`);
        return true;
      } else {
        this.logger.error('Échec de la définition de l\'énigme sur la blockchain');
        return false;
      }
    } catch (error) {
      this.logger.error('Erreur lors de la définition de l\'énigme sur la blockchain:', error);
      return false;
    }
  }
  
  /**
   * Réinitialise le jeu en effaçant la liste des énigmes utilisées
   * et en définissant la première énigme sur la blockchain
   */
  async resetGame(): Promise<boolean> {
    try {
      this.logger.log('Réinitialisation du jeu...');
      
      // Réinitialiser la liste des énigmes utilisées
      this.usedRiddleIndices.clear();
      this.lastProposedRiddleIndex = null;
      this.currentOnchainRiddleIndex = null;
      
      // Réinitialiser les énigmes résolues et les statistiques
      this.solvedRiddles.clear();
      this.gameStats = {
        totalRiddlesSolved: 0,
        onchainRiddlesSolved: 0,
        localRiddlesSolved: 0,
        startTime: new Date(),
        lastSolvedTime: null,
        playerStats: new Map<string, { victories: number, lastVictory: Date }>(),
      };
      
      this.logger.log('Liste des énigmes utilisées et statistiques réinitialisées');
      
      // Définir la première énigme du tableau sur la blockchain
      const firstRiddleIndex = 0; // Toujours commencer par la première énigme
      const success = await this.setSpecificRiddleOnchain(firstRiddleIndex);
      
      if (success) {
        this.logger.log(`Jeu réinitialisé avec succès! Première énigme définie: "${this.riddlesWithHash[firstRiddleIndex].text}"`);
        
        // Publier l'événement de réinitialisation du jeu
        await this.pubSub.publish('gameReset', { 
          gameReset: true 
        });
        
        // Créer l'objet de la nouvelle énigme
        const newRiddle = {
          id: 'onchain',
          question: this.riddlesWithHash[firstRiddleIndex].text,
          solved: false,
          onchain: true
        };
        
        // Publier l'événement de nouvelle énigme via GraphQL
        await this.pubSub.publish('newRiddle', { 
          newRiddle: newRiddle
        });
        
        // Envoyer la nouvelle énigme à tous les joueurs via Socket.IO
        console.log('Envoi de la nouvelle énigme à tous les joueurs via Socket.IO après réinitialisation...');
        this.socketService.emitNewRiddle({
          id: newRiddle.id,
          question: newRiddle.question
        });
        console.log('Nouvelle énigme après réinitialisation envoyée avec succès via Socket.IO');
        
        return true;
      } else {
        this.logger.error('Erreur lors de la réinitialisation du jeu');
        return false;
      }
      
      return success;
    } catch (error) {
      this.logger.error('Erreur lors de la réinitialisation du jeu:', error);
      return false;
    }
  }
}
