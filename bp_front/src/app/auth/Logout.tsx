"use client"

import React, {useEffect} from "react";
import {Box, Button, Grid, IconButton, Typography} from "@mui/material";
import {usePathname, useRouter} from "next/navigation";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";


export default function Logout() {
  const path = usePathname()
  const router = useRouter()

  const [activeUser, setActiveUser] = React.useState("");
  useEffect(() => {
    setActiveUser(localStorage.getItem("username") || "");
  }, [path])

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault()
    router.push("/auth")
  }

  const handleLogout = (e?: React.FormEvent) => {
    e?.preventDefault()
    localStorage.removeItem("token")
    localStorage.removeItem("username")
    setActiveUser("");
    router.push("/")
  }

  return activeUser === "" ? (
    <Box component="form" noValidate onSubmit={handleLogin}>
      <Grid container spacing={1} direction="row" justifyContent="flex-end" alignItems="center">
        <Grid item><Button type={"submit"}>Login</Button></Grid>
        <Grid item><IconButton type={"submit"} aria-label="logout"> <LoginIcon/> </IconButton></Grid>
      </Grid>
    </Box>
  ) : (
    <Box component="form" noValidate onSubmit={handleLogout}>
      <Grid container spacing={1} direction="row" justifyContent="flex-end" alignItems="center">
        <Grid item><Typography>{activeUser}</Typography></Grid>
        <Grid item><IconButton type={"submit"} aria-label="logout"> <LogoutIcon/> </IconButton></Grid>
      </Grid>
    </Box>
  )
}
