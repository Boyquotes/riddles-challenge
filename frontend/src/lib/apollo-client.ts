import { ApolloClient, InMemoryCache, HttpLink, split, NormalizedCacheObject, from } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { createClient } from 'graphql-ws';

// This approach ensures the Apollo client is initialized only on the client side
// and is properly shared between requests
let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

function createApolloClient() {
  // Create an HTTP link for queries and mutations
  const httpLink = new HttpLink({
    uri: 'http://localhost:3001/graphql',
  });

  // Create a retry link with custom logic
  const retryLink = new RetryLink({
    delay: {
      initial: 1000, // Initial delay in milliseconds
      max: 5000,     // Maximum delay
      jitter: true   // Randomize delay
    },
    attempts: {
      max: 3,        // Max number of retries
      retryIf: (error, operation) => {
        // Only retry for specific operations or errors
        const operationName = operation.operationName;
        console.log(`Checking if should retry operation: ${operationName}`);
        
        // Always retry randomRiddle query
        if (operationName === 'GetRandomRiddle') {
          console.log('Will retry randomRiddle query...');
          return true;
        }
        
        return !!error; // Retry on any error for other operations
      }
    }
  });

  // Create an error handling link for logging
  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}, Operation: ${operation.operationName}`,
        );
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError}`);
    }
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
  const splitLink = typeof window !== 'undefined' && wsLink != null
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

  // Combine all links - retry first, then error handling, then route to HTTP/WS
  const link = from([retryLink, errorLink, splitLink]);

  return new ApolloClient({
    ssrMode: typeof window === 'undefined', // Set to true for SSR
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Riddle: {
          fields: {
            // Définir des valeurs par défaut pour les champs qui pourraient être manquants
            solved: {
              read(solved = false) {
                return solved;
              }
            },
            onchain: {
              read(onchain = true) {
                return onchain;
              }
            }
          }
        }
      }
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'network-only', // Ne pas utiliser le cache pour les requêtes
        errorPolicy: 'all',
        notifyOnNetworkStatusChange: true,
      },
      query: {
        fetchPolicy: 'network-only',
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
