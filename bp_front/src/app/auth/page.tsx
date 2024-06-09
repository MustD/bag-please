'use client'

import React from "react";
import {Box, Grid, IconButton, TextField, Typography} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import {useRouter} from "next/navigation";

type LoginForm = {
  username: string,
  password: string,
  usernameValidationError: string,
  passwordValidationError: string,
}

export default function LoginPage() {
  const initialForm = {
    username: "",
    password: "",
    usernameValidationError: "",
    passwordValidationError: ""
  }

  const [formValues, setFormValues] = React.useState<LoginForm>(initialForm);
  const changeForm = (user: string, pass: string) => {
    setFormValues({
      username: user, password: pass, usernameValidationError: "", passwordValidationError: ""
    });
  };

  const router = useRouter()

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (formValues.username === "" || formValues.password === "") {
      setFormValues({
        ...formValues,
        usernameValidationError: formValues.username === "" ? "Enter username" : "",
        passwordValidationError: formValues.password === "" ? "Enter password" : "",
      });
      return
    }

    const submitData = {username: formValues.username, password: formValues.password}
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify(submitData),
        headers: {'content-type': 'application/json'}
      })
      if (res.ok) {
        const data = await res.json() as { user: string, token: string }
        localStorage.setItem("token", data.token)
        localStorage.setItem("username", data.user)
        router.push("/")
      } else {
        console.log("Auth failed.")
      }
    } catch (error) {
      console.log(error)
    }
    setFormValues(initialForm)
  }


  return (
    <Box component="form" noValidate onSubmit={handleLogin}>
      <Grid container spacing={1} direction="column" justifyContent="flex-start" alignItems="center">
        <Grid item><Typography>Login</Typography></Grid>
        <Grid item>
          <TextField
            id="user"
            name="user"
            label="User"
            variant="standard"
            error={formValues.usernameValidationError != ""}
            helperText={formValues.usernameValidationError}
            value={formValues.username}
            onChange={(event) => changeForm(event.target.value, formValues.password)}
          />
        </Grid>
        <Grid item>
          <TextField
            id="password"
            name="password"
            label="Password"
            variant="standard"
            type="password"
            error={formValues.passwordValidationError != ""}
            helperText={formValues.passwordValidationError}
            value={formValues.password}
            onChange={(event) => changeForm(formValues.username, event.target.value)}
          />
        </Grid>
        <Grid item><IconButton type={"submit"} aria-label="login"> <LoginIcon/> </IconButton></Grid>
      </Grid>
    </Box>
  )
}
