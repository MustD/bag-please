import {Box, Paper} from "@mui/material";
import Items from "@/app/store/item/Items";
import CreateItem from "@/app/store/item/CreateItem";

export default function ItemsPage() {
  return (
    <Box>
      <Paper sx={{p: 1}}>
        <Items/>
        <CreateItem/>
      </Paper>
    </Box>
  );
}
