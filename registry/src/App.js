import { Container, CssBaseline, Box } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import PackageList from './components/PackageList';
import Header from './components/Header';
import { theme } from './theme';
import { Routes, Route } from 'react-router-dom';
import UserProfile from './components/UserProfile';
import Footer from './components/Footer';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Header />
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flex: 1 }}>
          <Routes>
            <Route path="/" element={<PackageList />} />
            <Route path="/profile" element={<UserProfile />} />
          </Routes>
        </Container>
        <Footer />
      </Box>
    </ThemeProvider>
  );
}

export default App; 