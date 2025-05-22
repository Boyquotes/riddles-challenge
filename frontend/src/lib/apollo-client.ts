import { ApolloClient, InMemoryCache, HttpLink, split, NormalizedCacheObject } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// This approach ensures the Apollo client is initialized only on the client side
// and is properly shared between requests
let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

function createApolloClient() {
  // Create an HTTP link for queries and mutations
  const httpLink = new HttpLink({
    uri: 'http://localhost:3001/graphql',
  });

  // Only create the WebSocket link on the client
  const wsLink = typeof window !== 'undefined' 
    ? new GraphQLWsLink(
        createClient({
          url: 'ws://localhost:3001/graphql',
          retryAttempts: 5,
          connectionParams: {}
        })
      ) 
    : null;

  // Use split to route the operations to the correct link
  const link = typeof window !== 'undefined' && wsLink != null
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink
      )
    : httpLink;

  return new ApolloClient({
    ssrMode: typeof window === 'undefined', // Set to true for SSR
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
    connectToDevTools: typeof window !== 'undefined',
  });
}

export function getApolloClient() {
  // For SSR, always create a new client
  if (typeof window === 'undefined') {
    return createApolloClient();
  }

  // For client-side, reuse the client instance
  if (!apolloClient) {
    apolloClient = createApolloClient();
  }
  
  return apolloClient;
}
