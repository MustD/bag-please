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
            color={currentPath === "/store" ? "primary" : "secondary"}
            onClick={() => router.push("/store")}>To buy</Button>
        </Grid>
        <Grid item>
          <Button
            variant={"outlined"}
            color={currentPath.startsWith("/store/item") ? "primary" : "secondary"}
            onClick={() => router.push("/store/item")}>Item Management</Button>
        </Grid>
        <Grid item>
          <Button
            variant={"outlined"}
            color={currentPath.startsWith("/store/category") ? "primary" : "secondary"}
            onClick={() => router.push("/store/category")}>Category Management</Button>
        </Grid>
      </Grid>
    </Box>
  )
}
