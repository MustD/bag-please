import {Box, Checkbox, FormControlLabel, FormGroup, Paper} from "@mui/material";
import Typography from "@mui/material/Typography";
import Items from "@/app/Items";

export default function Home() {
  return (
    <Box>
      <Paper sx={{p: 1}}>
        <Typography variant={"caption"}>WIP</Typography>
        <Items/>
        <FormGroup>
          <FormControlLabel control={<Checkbox/>} label="Label 1"/>
          <FormControlLabel control={<Checkbox/>} label="Label 2"/>
          <FormControlLabel control={<Checkbox/>} label="Label 3"/>
        </FormGroup>
      </Paper>
    </Box>
  );
}
