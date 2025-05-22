"use client";

import { ApolloProvider } from '@apollo/client';
import { getApolloClient } from '@/lib/apollo-client';
import React, { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const client = getApolloClient();

  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}
