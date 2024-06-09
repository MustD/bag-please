import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Logout from "@/app/auth/Logout";
import Navigation from "@/app/Navigation";

export default function AppHeader() {
  return (
    <Box sx={{flexGrow: 1}}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{flexGrow: 1}}>Bag please</Typography>
          <Logout/>
        </Toolbar>
        <Navigation/>
      </AppBar>
    </Box>
  );
}
