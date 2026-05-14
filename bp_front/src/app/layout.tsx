import CssBaseline from "@mui/material/CssBaseline";
import type {Metadata, Viewport} from "next";
import Box from "@mui/material/Box";
import {ThemeProvider} from "@mui/material";
import {AppRouterCacheProvider} from '@mui/material-nextjs/v13-appRouter';
import theme from '@/lib/theme'
import AppHeader from "./AppHeader";
import {AuthProvider} from "@/lib/auth/AuthContext";
import ApolloWrapper from "@/lib/apollo/ApolloWrapper";
import RouteGuard from "@/app/RouteGuard";

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
    <body>
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <AuthProvider>
          <ApolloWrapper>
            <Box sx={{display: 'flex', flexDirection: 'column', height: '100vh'}}>
              <AppHeader/>
              <Box sx={{flex: 1, overflow: 'auto', minHeight: 0, bgcolor: 'background.default'}}>
                <RouteGuard>
                  {children}
                </RouteGuard>
              </Box>
            </Box>
          </ApolloWrapper>
        </AuthProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
    </body>
    </html>
  );
}
