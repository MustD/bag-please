"use client"

import {ApolloLink, HttpLink, split} from "@apollo/client"
import {ApolloClient, ApolloNextAppProvider, InMemoryCache, SSRMultipartLink} from "@apollo/client-integration-nextjs"
import {getMainDefinition} from "@apollo/client/utilities"
import {GraphQLWsLink} from '@apollo/client/link/subscriptions'
import {createClient} from 'graphql-ws'
import {SetContextLink} from "@apollo/client/link/context"
import {ErrorLink} from "@apollo/client/link/error"
import {CombinedGraphQLErrors, ServerError} from "@apollo/client/errors"
import {Observable} from 'rxjs'
import {useRef, useState} from 'react'
import {useRouter} from 'next/navigation'
import {AuthState, useAuth} from '@/lib/auth/AuthContext'
import {authApi} from '@/lib/auth/authApi'

function parseJwt(token: string): { username: string; role: string } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function makeLink(
  accessTokenRef: React.MutableRefObject<string | null>,
  setAuthRef: React.MutableRefObject<(state: AuthState) => void>,
  clearAuthRef: React.MutableRefObject<() => void>,
  routerRef: React.MutableRefObject<ReturnType<typeof useRouter>>
): { apolloClient: ApolloClient; disposeWs: () => void } {
  const httpLink = new HttpLink({uri: "/api/graphql"})

  const host = typeof window === "undefined" ? 'localhost' : window.location.host
  const protocol = typeof window === "undefined" ? 'http:' : window.location.protocol
  const wsProtocol = protocol === 'https:' ? 'wss://' : 'ws://'

  const wsClient = createClient({
    url: `${wsProtocol}${host}/api/subscriptions`,
    connectionParams: () => ({
      Authorization: `Bearer ${accessTokenRef.current ?? ''}`,
    }),
  })
  const wsLink = new GraphQLWsLink(wsClient)

  const splitLink = split(
    ({query}) => {
      const definition = getMainDefinition(query)
      return (definition.kind === 'OperationDefinition' && definition.operation === 'subscription')
    },
    wsLink,
    httpLink,
  )

  const authLink = new SetContextLink((prevContext) => ({
    ...prevContext,
    headers: {
      ...(prevContext.headers as Record<string, string>),
      authorization: `Bearer ${accessTokenRef.current ?? ''}`,
    },
  }))

  const authErrorLink = new ErrorLink(({error, operation, forward}) => {
    if (ServerError.is(error) && error.statusCode === 401) {
      if (operation.getContext().retried) {
        clearAuthRef.current()
        routerRef.current.push('/auth?expired=1')
        return
      }

      return new Observable(observer => {
        authApi.refresh()
          .then(({accessToken}) => {
            const payload = parseJwt(accessToken)
            if (!payload) throw new Error('Malformed token from refresh')
            setAuthRef.current({
              username: payload.username,
              role: payload.role as 'admin' | 'user',
              accessToken,
            })
            accessTokenRef.current = accessToken
            operation.setContext({...operation.getContext(), retried: true})
          })
          .then(() => {
            const sub = forward(operation)
            sub.subscribe({
              next: v => observer.next(v),
              error: e => observer.error(e),
              complete: () => observer.complete(),
            })
          })
          .catch((e) => {
            clearAuthRef.current()
            routerRef.current.push('/auth?expired=1')
            observer.error(e)
          })
      })
    }

    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({message, locations, path}) =>
        console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
      )
    } else {
      console.log(`[Network error]: ${error}`)
    }
  })

  return {
    apolloClient: new ApolloClient({
      cache: new InMemoryCache(),
      link:
        typeof window === "undefined"
          ? ApolloLink.from([
            new SSRMultipartLink({stripDefer: true}),
            httpLink,
          ])
          : ApolloLink.from([authLink, authErrorLink, splitLink]),
    }),
    disposeWs: () => { wsClient.dispose() },
  }
}

export default function ApolloWrapper({children}: React.PropsWithChildren) {
  const auth = useAuth()
  const router = useRouter()

  const accessTokenRef = useRef(auth.accessToken)
  const setAuthRef = useRef(auth.setAuth)
  const clearAuthRef = useRef(auth.clearAuth)
  const routerRef = useRef(router)

  /* eslint-disable react-hooks/refs -- intentional ref-as-stable-container pattern for Apollo link; refs are not read during render, only passed by reference */
  const [{apolloClient, disposeWs}] = useState(() => makeLink(accessTokenRef, setAuthRef, clearAuthRef, routerRef))

  accessTokenRef.current = auth.accessToken
  setAuthRef.current = auth.setAuth
  clearAuthRef.current = () => {
    disposeWs()
    auth.clearAuth()
  }
  routerRef.current = router
  /* eslint-enable react-hooks/refs */

  return (
    <ApolloNextAppProvider makeClient={() => apolloClient}>
      {children}
    </ApolloNextAppProvider>
  )
}
