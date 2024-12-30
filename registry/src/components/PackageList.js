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
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';

function PackageList({ searchQuery }) {
  const [packageData, setPackageData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    fetch('https://download.shinkai.com/tools/directory.json')
      .then(response => response.json())
      .then(data => {
        setPackageData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching package data:', error);
        setPackageData([]);
        setLoading(false);
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

  const handleCopyLink = (fileUrl) => {
    navigator.clipboard.writeText(fileUrl)
      .then(() => {
        console.log('Link copied to clipboard');
        setSnackbarOpen(true);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
      });
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const filteredPackages = packageData.filter(pkg => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = pkg.name.toLowerCase().includes(searchLower);
    const descMatch = pkg.description.toLowerCase().includes(searchLower);
    const keywordMatch = pkg.keywords ? 
      pkg.keywords.some(keyword => 
        keyword.toLowerCase().trim().includes(searchLower)
      ) : false;
    
    return nameMatch || descMatch || keywordMatch;
  });

  return (
    <>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          {loading ? (
            <Typography variant="h6" color="text.secondary">
              Loading packages...
            </Typography>
          ) : filteredPackages.length === 0 ? (
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
              <Card key={pkg.name}>
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
                      {pkg.keywords && (
                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                          {pkg.keywords.map((keyword, index) => (
                            <Chip
                              key={index}
                              label={keyword.trim()}
                              size="small"
                              sx={{
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                color: 'text.secondary',
                                fontSize: '0.75rem'
                              }}
                            />
                          ))}
                        </Stack>
                      )}
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
                        {pkg.tool_type && (
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
                            <b>Type</b>: {pkg.tool_type}
                          </Typography>
                        )}                          
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
                            <b>Author</b>: <a href={`https://shinkai-contracts.pages.dev/identity/${pkg.author.replace(/^@@/, '')}`} target="_blank" rel="noopener noreferrer">{pkg.author}</a>
                          </Typography>
                        )}                      
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1}>
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
                      <Chip 
                        label="Copy Link"
                        onClick={() => handleCopyLink(pkg.file)}
                        clickable
                        sx={{ 
                          mt: 1,
                          fontWeight: 500,
                          backgroundColor: 'rgb(45, 44, 50)',
                          borderBottom: '2px solid rgb(61, 63, 67)',
                          '&:hover': {
                            backgroundColor: 'rgb(61, 63, 67)',
                          },
                        }}
                      />
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message="Link copied to clipboard"
        action={
          <Chip 
            label="Close"
            onClick={handleSnackbarClose}
            color="inherit"
            sx={{ fontWeight: 500 }}
          />
        }
      />

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