import {Paper} from "@mui/material";

export default function ItemsLayout({children}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Paper>
      {children}
    </Paper>
  );
}
