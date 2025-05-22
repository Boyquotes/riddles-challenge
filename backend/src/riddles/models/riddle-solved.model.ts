import { Field, ObjectType } from '@nestjs/graphql';
import { Riddle } from './riddle.model';

@ObjectType()
export class RiddleSolvedResponse {
  @Field()
  solvedBy: string;

  @Field(() => Riddle)
  newRiddle: Riddle;
}
