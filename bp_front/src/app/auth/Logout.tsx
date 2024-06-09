"use client"

import React, {useEffect} from "react";
import {Box, Grid, IconButton, Typography} from "@mui/material";
import {usePathname, useRouter} from "next/navigation";
import LogoutIcon from "@mui/icons-material/Logout";

export default function Logout() {
  const path = usePathname()
  const router = useRouter()

  const [activeUser, setActiveUser] = React.useState("");
  useEffect(() => {
    setActiveUser(localStorage.getItem("username") || "");
  }, [path])

  const handleLogout = (e?: React.FormEvent) => {
    e?.preventDefault()
    localStorage.removeItem("token")
    localStorage.removeItem("username")
    setActiveUser("");
    router.push("/")
  }

  return activeUser === "" ? null : (
    <Box component="form" noValidate onSubmit={handleLogout}>
      <Grid container spacing={1} direction="row" justifyContent="flex-end" alignItems="center">
        <Grid item><Typography>{activeUser}</Typography></Grid>
        <Grid item><IconButton type={"submit"} aria-label="logout"> <LogoutIcon/> </IconButton></Grid>
      </Grid>
    </Box>
  )
}
