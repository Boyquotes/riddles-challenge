import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { RiddlesService } from './riddles.service';
import { Riddle } from './models/riddle.model';
import { RiddleSolvedResponse } from './models/riddle-solved.model';
import { MetaMaskTransaction } from './models/metamask-transaction.model';
import { GameOverStats } from './models/game-over-stats.model';
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
      // Publier immédiatement l'événement de résolution avec la réponse actuelle
      // La nouvelle énigme sera définie automatiquement après un délai par le service
      try {
        const currentRiddle = await this.riddlesService.getRiddle(id);
        
        // S'assurer que l'objet riddle est conforme au modèle GraphQL
        // en incluant toutes les propriétés requises
        if (currentRiddle) {
          // Créer un nouvel objet Riddle complet avec toutes les propriétés requises
          const completeRiddle: Riddle = {
            id: currentRiddle.id || 'unknown',
            question: currentRiddle.question || 'Question non disponible',
            solved: currentRiddle.solved !== undefined ? currentRiddle.solved : true,
            answer: currentRiddle.answer || '',
            onchain: currentRiddle.onchain !== undefined ? currentRiddle.onchain : false
          };
          
          console.log('Publication de l\'énigme résolue avec les données complètes:', JSON.stringify(completeRiddle));
          
          this.pubSub.publish('riddleSolved', { 
            riddleSolved: {
              solvedBy: playerId,
              newRiddle: completeRiddle
            }
          });
        }
      } catch (error) {
        console.error('Erreur lors de la publication GraphQL après vérification de réponse:', error);
      }
    }
    
    return isCorrect;
  }
  
  @Query(() => MetaMaskTransaction)
  async prepareMetaMaskTransaction(
    @Args('answer') answer: string,
  ): Promise<MetaMaskTransaction> {
    return this.riddlesService.prepareMetaMaskTransaction(answer);
  }
  
  @Mutation(() => Boolean)
  async setSpecificRiddleOnchain(
    @Args('index') index: number,
  ): Promise<boolean> {
    const success = await this.riddlesService.setSpecificRiddleOnchain(index);
    
    if (success) {
      // Récupérer la nouvelle énigme pour la publier via GraphQL subscription
      try {
        const newRiddle = await this.riddlesService.getRiddle('onchain');
        
        // S'assurer que l'objet riddle est conforme au modèle GraphQL
        if (newRiddle) {
          // Vérifier que toutes les propriétés requises sont présentes
          const riddleWithSolved = newRiddle as Riddle & { solved?: boolean };
          if (riddleWithSolved.solved === undefined) {
            riddleWithSolved.solved = false; // Nouvelle énigme, donc non résolue
          }
          
          // Publier l'événement pour les abonnés GraphQL
          this.pubSub.publish('riddleSolved', { 
            riddleSolved: {
              solvedBy: 'system', // Indiquer que c'est le système qui a défini la nouvelle énigme
              newRiddle
            }
          });
        }
      } catch (error) {
        console.error('Erreur lors de la publication GraphQL après définition d\'une énigme spécifique:', error);
      }
    }
    
    return success;
  }
  
  @Mutation(() => Boolean)
  async resetGame(): Promise<boolean> {
    const success = await this.riddlesService.resetGame();
    
    if (success) {
      // Récupérer la nouvelle énigme pour la publier via GraphQL subscription
      try {
        const newRiddle = await this.riddlesService.getRiddle('onchain');
        
        // S'assurer que l'objet riddle est conforme au modèle GraphQL
        if (newRiddle) {
          // Vérifier que toutes les propriétés requises sont présentes
          const riddleWithSolved = newRiddle as Riddle & { solved?: boolean };
          if (riddleWithSolved.solved === undefined) {
            riddleWithSolved.solved = false; // Nouvelle énigme après réinitialisation, donc non résolue
          }
          
          // Publier l'événement pour les abonnés GraphQL
          this.pubSub.publish('riddleSolved', { 
            riddleSolved: {
              solvedBy: 'system', // Indiquer que c'est le système qui a réinitialisé le jeu
              newRiddle
            }
          });
        }
      } catch (error) {
        console.error('Erreur lors de la publication GraphQL après réinitialisation du jeu:', error);
      }
    }
    
    return success;
  }

  @Subscription(() => RiddleSolvedResponse, {
    name: 'riddleSolved',
  })
  riddleSolved() {
    return this.pubSub.asyncIterator('riddleSolved');
  }
  
  @Query(() => GameOverStats)
  async gameOverStats(): Promise<GameOverStats> {
    return this.riddlesService.getGameOverStats();
  }
}
