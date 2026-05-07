import CssBaseline from "@mui/material/CssBaseline";
import type {Metadata, Viewport} from "next";
import {Inter} from "next/font/google";
import Box from "@mui/material/Box";
import {ThemeProvider} from "@mui/material";
import {AppRouterCacheProvider} from '@mui/material-nextjs/v13-appRouter';
import theme from './theme'
import AppHeader from "./AppHeader";

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
    <body className={inter.className}>
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100vh'}}>
          <AppHeader/>
          <Box sx={{flex: 1, overflow: 'auto', minHeight: 0, bgcolor: 'background.default'}}>
            {children}
          </Box>
        </Box>
      </ThemeProvider>
    </AppRouterCacheProvider>
    </body>
    </html>
  );
}
