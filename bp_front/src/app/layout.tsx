import CssBaseline from "@mui/material/CssBaseline";
import type {Metadata, Viewport} from "next";
import Box from "@mui/material/Box";
import {AuthProvider} from "@/lib/auth/AuthContext";
import ApolloWrapper from "@/lib/apollo/ApolloWrapper";
import RouteGuard from "@/app/RouteGuard";
import BPBottomNav from "@/app/BPBottomNav";
import ThemeRegistry from "@/app/ThemeRegistry";

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
    <ThemeRegistry>
      <CssBaseline/>
      <AuthProvider>
        <ApolloWrapper>
          <Box sx={{display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 480, mx: 'auto'}}>
            <Box sx={{flex: 1, overflow: 'auto', minHeight: 0, pb: '96px'}}>
              <RouteGuard>
                {children}
              </RouteGuard>
            </Box>
            <BPBottomNav/>
          </Box>
        </ApolloWrapper>
      </AuthProvider>
    </ThemeRegistry>
    </body>
    </html>
  );
}
