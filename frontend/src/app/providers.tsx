"use client";

import { ApolloProvider } from '@apollo/client';
import { getApolloClient } from '@/lib/apollo-client';
import React, { ReactNode } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const client = getApolloClient();

  return (
    <ApolloProvider client={client}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ApolloProvider>
  );
}
