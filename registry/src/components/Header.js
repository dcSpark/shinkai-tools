import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material';
import { usePrivy } from '@privy-io/react-auth';
import { Link } from 'react-router-dom';

function Header() {
  const {ready, authenticated, login, logout} = usePrivy();

  return (
    <AppBar position="static">
      <Toolbar sx={{ flexDirection: { xs: 'column', sm: 'row' }, py: 2, gap: 2 }}>
        <Box sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2 
        }}>
          <img 
            src="/shinkai-logo.png" 
            alt="Shinkai Logo" 
            style={{ height: '32px', cursor: 'pointer' }} 
            onClick={() => window.location.href = '/'}
          />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 600,
              color: 'white',
            }}
          >
            AI Store
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {ready && authenticated ? (
            <>
              <Chip
                label="Profile"
                component={Link}
                to="/profile"
                clickable
                color="primary"
                sx={{ 
                  borderRadius: 1
                }}
              />
              <Chip
                label="Log out"
                onClick={logout}
                clickable
                color="primary"
                sx={{ 
                  borderRadius: 1
                }}
              />
            </>
          ) : (
            <Chip
              label="Login"
              onClick={() => login()}
              disabled={!ready}
              clickable
              color="primary"
              sx={{ 
                borderRadius: 1
              }}
            />
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header; 