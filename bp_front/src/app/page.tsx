import {Box, Paper} from "@mui/material";
import Items from "@/app/Items/Items";
import CreateItem from "@/app/Items/CreateItem";

export default function Home() {
  return (
    <Box>
      <Paper sx={{p: 1}}>
        <Items/>
        <CreateItem/>
      </Paper>
    </Box>
  );
}
