import {ApolloClient, ApolloLink, HttpLink, InMemoryCache, split} from '@apollo/client'
import {ApolloProvider} from '@apollo/client/react'
import {getMainDefinition} from '@apollo/client/utilities'
import {GraphQLWsLink} from '@apollo/client/link/subscriptions'
import {createClient} from 'graphql-ws'
import {SetContextLink} from '@apollo/client/link/context'
import {ErrorLink} from '@apollo/client/link/error'
import {CombinedGraphQLErrors, ServerError} from '@apollo/client/errors'
import {Observable} from 'rxjs'
import {type ReactNode, type RefObject, useEffect, useRef, useState} from 'react'
import {type AuthState, useAuth} from '@/lib/auth/AuthContext'
import {parseJwt} from '@/lib/auth/jwt'
import {authApi} from '@/lib/auth/authApi'

function makeClient(
  accessTokenRef: RefObject<string | null>,
  setAuthRef: RefObject<(state: AuthState) => void>,
  clearAuthRef: RefObject<(expired?: boolean) => void>,
): { apolloClient: ApolloClient; disposeWs: () => void } {
  const httpLink = new HttpLink({uri: '/api/graphql'})

  // graphql-ws client for subscriptions. The access token is read lazily from a
  // ref on every connection_init, so reconnects always carry the latest token.
  const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  const wsClient = createClient({
    url: `${wsProtocol}${window.location.host}/api/subscriptions`,
    connectionParams: () => ({
      Authorization: `Bearer ${accessTokenRef.current ?? ''}`,
    }),
  })
  const wsLink = new GraphQLWsLink(wsClient)

  // Route subscriptions over the WebSocket link; everything else over HTTP.
  const splitLink = split(
    ({query}) => {
      const definition = getMainDefinition(query)
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
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

  // On HTTP 401: attempt one silent refresh, then retry the operation once with
  // the fresh token. If the refresh fails, or the retried request 401s again,
  // clear auth as expired — RouteGuard turns that into the /auth?expired=1
  // redirect (single redirect owner, so no navigation race).
  const authErrorLink = new ErrorLink(({error, operation, forward}) => {
    if (ServerError.is(error) && error.statusCode === 401 && !operation.getContext().retried) {
      return new Observable(observer => {
        let inner: { unsubscribe: () => void } | undefined
        authApi.refresh()
          .then(({accessToken}) => {
            const payload = parseJwt(accessToken)
            if (!payload) throw new Error('Malformed token from refresh')
            setAuthRef.current({username: payload.username, role: payload.role, accessToken})
            accessTokenRef.current = accessToken
            // The retried operation is forwarded downstream and never re-runs
            // authLink, so re-apply the Authorization header from the fresh
            // token here — otherwise the retry would resend the stale one.
            operation.setContext({
              ...operation.getContext(),
              retried: true,
              headers: {
                ...(operation.getContext().headers as Record<string, string>),
                authorization: `Bearer ${accessToken}`,
              },
            })
          })
          .then(() => {
            inner = forward(operation).subscribe({
              next: v => observer.next(v),
              error: e => {
                // The nested forward never re-enters this error link, so the
                // terminal "still unauthorized after retry" case is handled here.
                if (ServerError.is(e) && e.statusCode === 401) clearAuthRef.current(true)
                observer.error(e)
              },
              complete: () => observer.complete(),
            })
          })
          .catch((e) => {
            clearAuthRef.current(true)
            observer.error(e)
          })
        return () => inner?.unsubscribe()
      })
    }

    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({message, locations, path}) =>
        console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`),
      )
    } else {
      console.log(`[Network error]: ${error}`)
    }
  })

  return {
    apolloClient: new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([authLink, authErrorLink, splitLink]),
    }),
    disposeWs: () => {
      wsClient.dispose()
    },
  }
}

export default function ApolloAppProvider({children}: { children: ReactNode }) {
  const auth = useAuth()

  const accessTokenRef = useRef(auth.accessToken)
  const setAuthRef = useRef(auth.setAuth)
  const clearAuthRef = useRef(auth.clearAuth)

  /* eslint-disable react-hooks/refs -- intentional ref-as-stable-container pattern for the Apollo links; the refs are carried by reference into the link callbacks and only dereferenced outside render (in network events) */
  const [{apolloClient, disposeWs}] = useState(() =>
    makeClient(accessTokenRef, setAuthRef, clearAuthRef),
  )

  // Keep the refs pointed at the latest auth values. clearAuth must dispose the
  // graphql-ws client BEFORE clearing React state, so orphaned subscription
  // events can't arrive after logout. Redirect-on-expiry is RouteGuard's job.
  accessTokenRef.current = auth.accessToken
  setAuthRef.current = auth.setAuth
  clearAuthRef.current = (expired?: boolean) => {
    disposeWs()
    auth.clearAuth(expired)
  }
  /* eslint-enable react-hooks/refs */

  // On logout/expiry (username → null), clear the Apollo cache so one user's
  // list data can't bleed into the next session in the same tab — HomeRedirect
  // and the list switcher navigate/render off the cached `lists` query, so a
  // stale cache would mis-redirect and briefly show the previous user's lists.
  // clearStore (not resetStore) empties without refetching as logged-out.
  const prevUsernameRef = useRef(auth.username)
  useEffect(() => {
    if (prevUsernameRef.current && !auth.username) {
      void apolloClient.clearStore().catch(() => {})
    }
    prevUsernameRef.current = auth.username
  }, [auth.username, apolloClient])

  return (
    <ApolloProvider client={apolloClient}>
      {children}
    </ApolloProvider>
  )
}
