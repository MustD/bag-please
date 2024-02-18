'use client'
import {Box, FormGroup} from "@mui/material";
import Typography from "@mui/material/Typography";
import {useQuery} from "@apollo/client";
import {getItemsQuery} from "@/app/Items/Queries";
import EditItem from "@/app/Items/EditItem";

export default function Items() {
  const {data, loading, error} = useQuery(getItemsQuery);
  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <FormGroup>
        {data?.getItems.map(item => (
          <EditItem key={item.id} id={item.id} name={item.name} checked={item.checked}/>
        ))}
      </FormGroup>
    </Box>
  );
}
