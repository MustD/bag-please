"use client"

import {Box, Paper} from "@mui/material";
import ItemsList from "@/app/store/ItemsList";
import React from "react";

export default function Home() {

  return (
    <Box>
      <Paper sx={{p: 1}}>
        <ItemsList/>
      </Paper>
    </Box>
  );
}
