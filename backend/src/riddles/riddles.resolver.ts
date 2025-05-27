import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { RiddlesService } from './riddles.service';
import { Riddle } from './models/riddle.model';
import { RiddleSolvedResponse } from './models/riddle-solved.model';
import { MetaMaskTransaction } from './models/metamask-transaction.model';
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
    try {
      // Ajouter un délai pour s'assurer que les opérations blockchain précédentes sont terminées
      // Ce délai est particulièrement important après des opérations comme setRandomRiddleOnchain
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const riddle = await this.riddlesService.getRandomRiddle();
      
      // Vérifier que tous les champs requis sont présents
      if (!riddle) {
        console.log('Aucune énigme retournée par getRandomRiddle, retour d\'une énigme par défaut');
        return {
          id: 'error',
          question: 'Impossible de récupérer l\'énigme. Veuillez rafraîchir la page.',
          solved: false,
          onchain: true
        };
      }
      
      // S'assurer que tous les champs sont définis et correctement typés
      const safeRiddle = {
        id: riddle.id || 'error',
        question: riddle.question || 'Chargement de l\'énigme...',
        solved: typeof riddle.solved === 'boolean' ? riddle.solved : false,
        answer: riddle.answer,
        onchain: typeof riddle.onchain === 'boolean' ? riddle.onchain : true
      };
      
      console.log('Énigme retournée par le resolver randomRiddle:', JSON.stringify(safeRiddle, null, 2));
      return safeRiddle;
    } catch (error) {
      console.error('Erreur dans le resolver randomRiddle:', error);
      
      // En cas d'erreur, retourner une énigme par défaut
      return {
        id: 'error',
        question: 'Une erreur est survenue lors du chargement de l\'énigme. Veuillez réessayer.',
        solved: false,
        onchain: true
      };
    }
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
      const currentRiddle = await this.riddlesService.getRiddle(id);
      this.pubSub.publish('riddleSolved', { 
        riddleSolved: {
          solvedBy: playerId,
          newRiddle: currentRiddle,
        }
      });
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
  async setRandomRiddleOnchain(): Promise<boolean> {
    const success = await this.riddlesService.setRandomRiddleOnchain();
    
    if (success) {
      // Récupérer la nouvelle énigme pour la publier via GraphQL subscription
      const newRiddle = await this.riddlesService.getRiddle('onchain');
      
      // Publier l'événement pour les abonnés GraphQL
      this.pubSub.publish('riddleSolved', { 
        riddleSolved: {
          solvedBy: 'system', // Indiquer que c'est le système qui a défini la nouvelle énigme
          newRiddle,
        }
      });
    }
    
    return success;
  }

  @Mutation(() => Boolean)
  async setSpecificRiddleOnchain(
    @Args('index') index: number,
  ): Promise<boolean> {
    const success = await this.riddlesService.setSpecificRiddleOnchain(index);
    
    if (success) {
      // Récupérer la nouvelle énigme pour la publier via GraphQL subscription
      const newRiddle = await this.riddlesService.getRiddle('onchain');
      
      // Publier l'événement pour les abonnés GraphQL
      this.pubSub.publish('riddleSolved', { 
        riddleSolved: {
          solvedBy: 'system', // Indiquer que c'est le système qui a défini la nouvelle énigme
          newRiddle,
        }
      });
    }
    
    return success;
  }
  
  @Mutation(() => Boolean)
  async resetGame(): Promise<boolean> {
    const success = await this.riddlesService.resetGame();
    
    if (success) {
      // Récupérer la nouvelle énigme pour la publier via GraphQL subscription
      const newRiddle = await this.riddlesService.getRiddle('onchain');
      
      // Publier l'événement pour les abonnés GraphQL
      this.pubSub.publish('riddleSolved', { 
        riddleSolved: {
          solvedBy: 'system', // Indiquer que c'est le système qui a réinitialisé le jeu
          newRiddle,
        }
      });
    }
    
    return success;
  }

  @Subscription(() => RiddleSolvedResponse, {
    name: 'riddleSolved',
  })
  riddleSolved() {
    return this.pubSub.asyncIterator('riddleSolved');
  }
}
