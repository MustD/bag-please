'use client'
import {Box, Link, Paper} from "@mui/material";
import Typography from "@mui/material/Typography";

export default function Home() {

  return (
    <Box>
      <Paper sx={{p: 1}}>
        <Typography>Welcome to the bag-please app.</Typography>
        <Typography>Work in progress.</Typography>
        <Typography>Check out our <Link target="_blank"
                                        href="https://github.com/MustD/bag-please">github</Link></Typography>
      </Paper>
    </Box>
  );
}
