'use client'
import {Box, Paper} from "@mui/material";
import Typography from "@mui/material/Typography";
import {gql} from "@/__generated__";
import {useQuery} from "@apollo/client";

const itemsQuery = gql(`query getItemsQuery {
  getItems {
    id, name, checked
  }
}`);

export default function Items() {
  const {data, loading, error} = useQuery(itemsQuery);
  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <Typography variant={"caption"}>{JSON.stringify(data)}</Typography>
      <Paper>
        {data?.getItems.map(item => (
          <Typography key={item.id}>{JSON.stringify(item)}</Typography>
        ))}
      </Paper>
    </Box>
  );
}
