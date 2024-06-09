"use client"

import {Box, Paper} from "@mui/material";
import Typography from "@mui/material/Typography";
import {redirect} from "next/navigation";

export default function Home() {
  redirect("/store/item")

  return (
    <Box>
      <Paper sx={{p: 1}}>
        <Typography>Store</Typography>
      </Paper>
    </Box>
  );
}
