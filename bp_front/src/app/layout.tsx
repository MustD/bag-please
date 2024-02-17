import CssBaseline from "@mui/material/CssBaseline";
import type {Metadata, Viewport} from "next";
import {Inter} from "next/font/google";
import {Container, ThemeProvider} from "@mui/material";
import {AppRouterCacheProvider} from '@mui/material-nextjs/v13-appRouter';
import theme from './theme'
import AppHeader from "./AppHeader";
import {ApolloWrapper} from "./lib/apollo-wraper"

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "Bag please",
  description: "To buy list management pet project",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({children}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
    <CssBaseline/>
    <body className={inter.className}>
    <AppRouterCacheProvider>
      <ApolloWrapper>
        <ThemeProvider theme={theme}>
          <Container maxWidth={false} sx={{height: '100vh', p: 1, bgcolor: 'background.default'}}>
            <AppHeader/>
            {children}
          </Container>
        </ThemeProvider>
      </ApolloWrapper>
    </AppRouterCacheProvider>
    </body>
    </html>
  );
}
