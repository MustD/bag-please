import Button from "@mui/material/Button";
import {Box, Container, Paper} from "@mui/material";

export default function Home() {
  return (
    <Container maxWidth="sm">
      <Box sx={{height: '100vh'}}>
        <Paper>
          <Button>Hello world</Button>
        </Paper>
      </Box>
    </Container>
  );
}
