import { AppBar, Toolbar, Typography, TextField, Box, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

function Header({ searchQuery, onSearchChange }) {
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
            style={{ height: '32px' }} 
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
        <Box sx={{ width: { xs: '100%', sm: '300px' } }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search packages..."
            size="small"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.paper',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
              },
              '& input': {
                color: 'text.primary',
                '&::placeholder': {
                  color: 'text.secondary',
                  opacity: 1,
                },
              },
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header; 