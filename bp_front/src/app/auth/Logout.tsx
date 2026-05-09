"use client"

import React from "react";
import {Box, Button, IconButton, Stack, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import {useAuth} from "@/lib/auth/AuthContext";
import {authApi} from "@/lib/auth/authApi";


export default function Logout() {
  const router = useRouter()
  const {username, clearAuth, isLoading} = useAuth()

  if (isLoading) return null

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault()
    router.push("/auth")
  }

  const handleLogout = async (e?: React.FormEvent) => {
    e?.preventDefault()
    await authApi.logout()
    clearAuth()
    router.push('/auth')
  }

  return username === null ? (
    <Box component="form" noValidate onSubmit={handleLogin}>
      <Stack direction="row" spacing={1} sx={{justifyContent: "flex-end", alignItems: "center"}}>
        <Button type={"submit"}>Login</Button>
        <IconButton type={"submit"} aria-label="logout"> <LoginIcon/> </IconButton>
      </Stack>
    </Box>
  ) : (
    <Box component="form" noValidate onSubmit={handleLogout}>
      <Stack direction="row" spacing={1} sx={{justifyContent: "flex-end", alignItems: "center"}}>
        <Typography>{username}</Typography>
        <IconButton type={"submit"} aria-label="logout"> <LogoutIcon/> </IconButton>
      </Stack>
    </Box>
  )
}
