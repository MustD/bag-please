"use client"

import {ApolloLink, HttpLink, split,} from "@apollo/client"
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
  SSRMultipartLink,
} from "@apollo/experimental-nextjs-app-support"
import {getMainDefinition} from "@apollo/client/utilities"
import {GraphQLWsLink} from '@apollo/client/link/subscriptions'
import {createClient} from 'graphql-ws'
import {setContext} from "@apollo/client/link/context"
import {onError} from "@apollo/client/link/error";

function makeLink(onAuthError: () => void) {

  const httpLink = new HttpLink({
    uri: "/api/graphql",
  })

  const host = typeof window === "undefined" ? 'localhost' : window.location.host
  const protocol = typeof window === "undefined" ? 'http:' : window.location.protocol
  const wsProtocol = protocol === 'https:' ? 'wss://' : 'ws://'

  const wsLink = new GraphQLWsLink(createClient({
    url: `${wsProtocol}${host}/api/subscriptions`,
  }))

  const splitLink = split(
    ({query}) => {
      const definition = getMainDefinition(query);
      return (definition.kind === 'OperationDefinition' && definition.operation === 'subscription')
    },
    wsLink,
    httpLink,
  );

  const authLink = setContext((_, {headers}) => {
    const token = localStorage.getItem('token') || ""
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      }
    }
  });

  const authErrorLink = onError(({graphQLErrors, networkError}) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({message, locations, path}) =>
        console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
      );
    }
    if (networkError) {
      console.log(`[Network error]: ${networkError}`);
      onAuthError()
    }
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link:
      typeof window === "undefined"
        ? ApolloLink.from([
          new SSRMultipartLink({
            stripDefer: true,
          }),
          httpLink,
        ])
        : authLink.concat(authErrorLink).concat(splitLink),
  });
}

export type ApolloWrapperProps = {
  onAuthError: () => void
}

export default function ApolloWrapper({children, onAuthError}: React.PropsWithChildren<ApolloWrapperProps>) {
  return (
    <ApolloNextAppProvider makeClient={() => makeLink(onAuthError)}>
      {children}
    </ApolloNextAppProvider>
  );
}
