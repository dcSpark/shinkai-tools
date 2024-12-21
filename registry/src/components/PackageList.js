import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid,
  Box,
  Chip,
  Alert,
  Stack
} from '@mui/material';

function PackageList({ searchQuery }) {
  const [packageData, setPackageData] = useState([]);

  useEffect(() => {
    fetch('https://packages.shinkai.com/tools/directory.json')
      .then(response => response.json())
      .then(data => setPackageData(data))
      .catch(error => {
        console.error('Error fetching package data:', error);
        setPackageData([]);
      });
  }, []);

  const filteredPackages = packageData.filter(pkg => 
    pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Grid container spacing={3}>
      {filteredPackages.length === 0 ? (
        <Grid item xs={12}>
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
        </Grid>
      ) : (
        filteredPackages.map((pkg) => (
          <Grid item xs={12} key={pkg.name}>
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
                    component="a"
                    href={`shinkai://tools/install?file=${pkg.file}`}
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
          </Grid>
        ))
      )}
    </Grid>
  );
}

export default PackageList; 