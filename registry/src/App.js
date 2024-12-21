import { useState } from 'react';
import { Container, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import PackageList from './components/PackageList';
import Header from './components/Header';
import { theme } from './theme';

function App() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Header 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <PackageList searchQuery={searchQuery} />
      </Container>
    </ThemeProvider>
  );
}

export default App; 