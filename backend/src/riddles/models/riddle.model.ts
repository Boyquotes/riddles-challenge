import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Riddle {
  @Field(() => ID)
  id: string;

  @Field()
  question: string;

  @Field({ nullable: true })
  answer?: string;

  @Field(() => Boolean)
  solved: boolean;
  
  @Field(() => Boolean, { nullable: true })
  onchain?: boolean;
}
