import { Box, Container, Typography, Link } from '@mui/material';

function Footer() {
  return (
    <Box 
      component="footer" 
      sx={{ 
        py: 3,
        mt: 'auto',
        backgroundColor: 'background.paper',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}>
          <Typography 
            variant="body2" 
            color="text.secondary"
          >
            © {new Date().getFullYear()} Shinkai. All rights reserved.
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            gap: 3,
            '& a': { 
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': {
                color: 'primary.main'
              }
            }
          }}>
            <Link href="https://www.shinkai.com/privacy-policy" variant="body2">
              Privacy Policy
            </Link>
            <Link href="https://www.shinkai.com/terms-of-service" variant="body2">
              Terms & Conditions
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default Footer; 