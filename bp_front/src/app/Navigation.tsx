'use client'

import {Box, Divider, Grid, IconButton, Menu} from "@mui/material";
import {usePathname, useRouter} from "next/navigation";
import * as React from "react";
import MenuIcon from "@mui/icons-material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Logout from "@/app/auth/Logout";

export default function Navigation() {
  const currentPath = usePathname()
  const router = useRouter()

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);
  const onOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget)
  }
  const onClose = () => {
    setMenuAnchor(null)
  }

  return (
    <Box sx={{p: 1}}>
      <Grid container spacing={1}>
        <Grid item>
          <IconButton
            onClick={onOpen}
            size="small"
            sx={{ml: 2}}
            aria-controls={menuOpen ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
          >
            <MenuIcon sx={{width: 32, height: 32}}/>
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            id="account-menu"
            open={menuOpen}
            onClose={onClose}
            onClick={onClose}
            slotProps={{
              paper: {
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    ml: -0.5,
                    mr: 1,
                  },
                  '&::before': {
                    content: '""',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: 'background.paper',
                    transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                },
              }
            }}
            transformOrigin={{horizontal: 'right', vertical: 'top'}}
            anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
          >
            <MenuItem>
              <Logout/>
            </MenuItem>
            <Divider/>
            <MenuItem onClick={() => {
              onClose()
              router.push("/")
            }}>
              <Typography>Home</Typography>
            </MenuItem>
            <Divider/>
            <MenuItem onClick={() => {
              onClose()
              router.push("/store")
            }}>
              <Typography color={currentPath.startsWith("/store") ? "secondary" : "primary"}>
                To Buy List
              </Typography>
            </MenuItem>
            {currentPath.startsWith("/store") ? (
              <Box>
                <Divider/>
                <MenuItem onClick={() => {
                  onClose()
                  router.push("/store/item")
                }}>
                  <Typography color={currentPath.startsWith("/store/item") ? "secondary" : "primary"}>
                    Item Management
                  </Typography>
                </MenuItem>
                <MenuItem onClick={() => {
                  onClose()
                  router.push("/store/category")
                }}>
                  <Typography color={currentPath.startsWith("/store/category") ? "secondary" : "primary"}>
                    Categories
                  </Typography>
                </MenuItem>
              </Box>
            ) : null}
          </Menu>
        </Grid>
      </Grid>
    </Box>
  )
}
