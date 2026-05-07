"use client"

import {ApolloLink, HttpLink, split} from "@apollo/client"
import {ApolloClient, ApolloNextAppProvider, InMemoryCache, SSRMultipartLink,} from "@apollo/client-integration-nextjs";
import {getMainDefinition} from "@apollo/client/utilities"
import {GraphQLWsLink} from '@apollo/client/link/subscriptions'
import {createClient} from 'graphql-ws'
import {SetContextLink} from "@apollo/client/link/context"
import {ErrorLink} from "@apollo/client/link/error";
import {CombinedGraphQLErrors} from "@apollo/client/errors";

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

  const authLink = new SetContextLink((prevContext) => {
    const token = localStorage.getItem('token') || ""
    return {
      ...prevContext,
      headers: {
        ...(prevContext.headers as Record<string, string>),
        authorization: `Bearer ${token}`,
      }
    }
  });

  const authErrorLink = new ErrorLink(({error}) => {
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({message, locations, path}) =>
        console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
      );
    } else {
      console.log(`[Network error]: ${error}`);
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
        : ApolloLink.from([authLink, authErrorLink, splitLink]),
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
