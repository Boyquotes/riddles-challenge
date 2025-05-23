import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MetaMaskTransaction {
  @Field()
  to: string;

  @Field()
  data: string;

  @Field()
  chainId: number;
  
  @Field({ nullable: true })
  networkName?: string;
  
  @Field({ nullable: true })
  currencyName?: string;
  
  @Field({ nullable: true })
  rpcUrl?: string;
  
  @Field({ nullable: true })
  blockExplorer?: string;
}
