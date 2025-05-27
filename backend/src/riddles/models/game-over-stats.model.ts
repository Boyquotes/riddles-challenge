import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Modèle pour les statistiques de jeu
 * Contient le nombre d'énigmes résolues et d'autres métriques
 */
@ObjectType()
export class GameStats {
  @Field(() => Number)
  totalRiddlesSolved: number;

  @Field(() => Number)
  onchainRiddlesSolved: number;

  @Field(() => Number)
  localRiddlesSolved: number;
}

/**
 * Modèle pour les statistiques de fin de jeu
 * Contient le nombre de victoires pour chaque joueur connecté
 */
@ObjectType()
export class GameOverStats {
  @Field(() => String)
  message: string;

  @Field(() => [PlayerStat])
  playerStats: PlayerStat[];
  
  @Field(() => GameStats, { nullable: true })
  stats?: GameStats;
}

/**
 * Modèle pour les statistiques d'un joueur
 */
@ObjectType()
export class PlayerStat {
  @Field(() => String)
  address: string;

  @Field(() => Number)
  victories: number;
}
