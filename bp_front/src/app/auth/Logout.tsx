"use client"

import React, {useEffect} from "react";
import {Box, Button, IconButton, Stack, Typography} from "@mui/material";
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
      <Stack direction="row" spacing={1} sx={{justifyContent: "flex-end", alignItems: "center"}}>
        <Button type={"submit"}>Login</Button>
        <IconButton type={"submit"} aria-label="logout"> <LoginIcon/> </IconButton>
      </Stack>
    </Box>
  ) : (
    <Box component="form" noValidate onSubmit={handleLogout}>
      <Stack direction="row" spacing={1} sx={{justifyContent: "flex-end", alignItems: "center"}}>
        <Typography>{activeUser}</Typography>
        <IconButton type={"submit"} aria-label="logout"> <LogoutIcon/> </IconButton>
      </Stack>
    </Box>
  )
}
