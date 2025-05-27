import { Field, ObjectType } from '@nestjs/graphql';

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
