import {Box, Paper} from "@mui/material";

export default function AuthLayout({children}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Box>
      <Paper sx={{p: 1}}>
        {children}
      </Paper>
    </Box>
  );
}
