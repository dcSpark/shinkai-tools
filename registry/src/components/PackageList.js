import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Container,
  Stack,
  Box,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';

function PackageList({ searchQuery }) {
  const [packageData, setPackageData] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch('https://packages.shinkai.com/tools/directory.json')
      .then(response => response.json())
      .then(data => setPackageData(data))
      .catch(error => {
        console.error('Error fetching package data:', error);
        setPackageData([]);
      });
  }, []);

  const handleInstallClick = (e, fileUrl) => {
    e.preventDefault();
    
    // Create hidden iframe for handling deeplink
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Set timeout to detect if app isn't installed
    const timeoutId = setTimeout(() => {
      setDialogOpen(true);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);

    // Try to open the deeplink
    iframe.src = `shinkai://tools/install?file=${fileUrl}`;

    // Listen for blur event which indicates app opened
    window.onblur = () => {
      clearTimeout(timeoutId);
      window.onblur = null;
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
  };

  const handleDownloadShinkai = () => {
    window.open('https://www.shinkai.com', '_blank');
    setDialogOpen(false);
  };

  const filteredPackages = packageData.filter(pkg => 
    pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          {filteredPackages.length === 0 ? (
            <Alert 
              severity="info"
              sx={{
                backgroundColor: 'background.paper',
                color: 'text.primary',
                '& .MuiAlert-icon': {
                  color: 'primary.main',
                },
              }}
            >
              No packages found matching your search criteria.
            </Alert>
          ) : (
            filteredPackages.map((pkg) => (
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography 
                          variant="h5" 
                          component="h2" 
                          sx={{ 
                            fontWeight: 600,
                            color: 'rgba(255, 255, 255, 0.9)',
                          }}
                        >
                          {pkg.name}
                        </Typography>
                        <Typography 
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          {pkg.version !== 'null' ? pkg.version : '0.0.0' }
                        </Typography>
                      </Box>
                      <Typography variant="body1" color="text.secondary" paragraph>
                        {pkg.description}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            display: 'inline-block',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          Hash: {pkg.hash.substring(0, 16)}...
                        </Typography>
                        {pkg.author && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              display: 'inline-block',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                            }}
                          >
                            <b>Author</b>: {pkg.author}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    <Chip 
                      label="Install"
                      onClick={(e) => handleInstallClick(e, pkg.file)}
                      clickable
                      color="primary"
                      sx={{ 
                        mt: 1,
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      </Container>

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: 'background.paper',
            color: 'text.primary',
          }
        }}
      >
        <DialogTitle>Shinkai Not Installed</DialogTitle>
        <DialogContent>
          <Typography>
            You do not have Shinkai installed. Would you like to download it now?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Chip onClick={() => setDialogOpen(false)} color="inherit" label="Cancel" />
          <Chip 
            onClick={handleDownloadShinkai} 
            color="primary" 
            variant="contained"
            label="Download Shinkai"
            sx={{
              fontWeight: 500,
            }}
          />
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PackageList; 