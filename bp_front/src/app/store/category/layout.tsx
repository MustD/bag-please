import {Box} from "@mui/material";

export default function ItemsLayout({children}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Box>
      {children}
    </Box>
  );
}
