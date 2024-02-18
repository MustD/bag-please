"use client";

import {ApolloLink, HttpLink, split,} from "@apollo/client";
import {
  ApolloNextAppProvider,
  NextSSRApolloClient,
  NextSSRInMemoryCache,
  SSRMultipartLink,
} from "@apollo/experimental-nextjs-app-support/ssr";
import {getMainDefinition} from "@apollo/client/utilities";
import {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import {createClient} from 'graphql-ws';

function makeLink() {

  const httpLink = new HttpLink({
    uri: "/api/graphql",
  });

  const host = typeof window === "undefined" ? 'localhost' : window.location.host;
  const protocol = typeof window === "undefined" ? 'http:' : window.location.protocol;
  const wsProtocol = protocol === 'https:' ? 'wss://' : 'ws://';

  const wsLink = new GraphQLWsLink(createClient({
    url: `${wsProtocol}${host}/api/subscriptions`,
  }));

  const splitLink = split(
    ({query}) => {
      const definition = getMainDefinition(query);
      return (definition.kind === 'OperationDefinition' && definition.operation === 'subscription');
    },
    wsLink,
    httpLink,
  );

  return new NextSSRApolloClient({
    cache: new NextSSRInMemoryCache(),
    link:
      typeof window === "undefined"
        ? ApolloLink.from([
          new SSRMultipartLink({
            stripDefer: true,
          }),
          httpLink,
        ])
        : splitLink,
  });
}

export function ApolloWrapper({children}: React.PropsWithChildren) {
  return (
    <ApolloNextAppProvider makeClient={makeLink}>
      {children}
    </ApolloNextAppProvider>
  );
}
