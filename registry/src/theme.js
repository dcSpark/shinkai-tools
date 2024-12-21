import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d25658',
      light: '#dd7879',
      dark: '#b84547',
    },
    background: {
      default: '#21252c',
      paper: '#2a2f37',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B3B3B3',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h6: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2f37',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2f37',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          '&:hover': {
            border: '1px solid rgba(255, 255, 255, 0.2)',
          },
        },
      },
    },
  },
}); 