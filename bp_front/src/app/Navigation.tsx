'use client'

import {Box, Button, Grid} from "@mui/material";
import {usePathname, useRouter} from "next/navigation";
import * as React from "react";

export default function Navigation() {
  const currentPath = usePathname()
  const router = useRouter()

  return (
    <Box sx={{p: 1}}>
      <Grid container spacing={1}>
        <Grid item>
          <Button
            variant={"outlined"}
            color={currentPath == "/" ? "secondary" : "primary"}
            onClick={() => router.push("/")}>Home</Button>
        </Grid>
        <Grid item>
          <Button
            variant={"outlined"}
            color={currentPath.startsWith("/store") ? "secondary" : "primary"}
            onClick={() => router.push("/store")}>store</Button>
        </Grid>
      </Grid>
    </Box>
  )
}
