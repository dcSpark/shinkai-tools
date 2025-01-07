import { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  Chip, 
  Stack,
  Divider 
} from '@mui/material';
import { usePrivy, useUpdateAccount, useLinkAccount } from '@privy-io/react-auth';
import config from '../config';
function UserProfile() {
  const { user, ready, authenticated } = usePrivy();
  const { linkEmail, linkPhone, linkWallet } = useLinkAccount({
    onSuccess: async (user) => {
      await fetch(`${config.SHINKAI_STORE_API}/user/update`, {
        method: "POST",
        headers: {
          "Authorization": JSON.parse(localStorage.getItem("privy:id_token")),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(user)
      });
    },
    onError: (error) => {
      console.log("Update account error.", error);
    }
  });

  const { updateEmail, updatePhone } = useUpdateAccount({
    onSuccess: async (user) => {
      await fetch(`${config.SHINKAI_STORE_API}/user/update`, {
        method: "POST",
        headers: {
          "Authorization": JSON.parse(localStorage.getItem("privy:id_token")),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(user)
      });
    },
    onError: (error) => {
      console.log("Update account error.", error);
    }
  });

  const [name, setName] = useState('');
  useEffect(() => {
    if (user?.customMetadata?.name) {
      setName(user.customMetadata.name);
    }
  }, [user]);

  if (!ready || !authenticated) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, backgroundColor: 'background.paper' }}>
          <Typography>Please login to view your profile.</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4, backgroundColor: 'background.paper' }}>
        <Typography variant="h4" gutterBottom>User Profile</Typography>

        <Stack spacing={3}>
          {/* Name Section */}
          <Box>
            <Typography variant="h6" gutterBottom>Name</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ color: 'text.secondary' }}>
                {name || 'No name set'}
              </Typography>
              <Chip
                label={name ? "Update Name" : "Set Name"}
                onClick={async() => {
                  const name = prompt("Enter your name:");
                  if (name) {
                    const response = await fetch(`${config.SHINKAI_STORE_API}/user/update`, {
                      method: "POST",
                      headers: {
                        "Authorization": JSON.parse(localStorage.getItem("privy:id_token")),
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        customMetadata: {
                          ...user?.customMetadata,
                          name
                        }
                      })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      console.log(data);
                      setName(data.customMetadata.name);
                    }
                  }
                }}
                color="primary"
              />
            </Stack>
          </Box>

          <Divider />

          
          {/* Wallet Section */}
          <Box>
            <Typography variant="h6" gutterBottom>Wallet</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
              {user?.wallet?.address || 'No wallet connected'} ({user?.wallet?.walletClientType})
            </Typography>
            {!user?.wallet?.address ?? (
              <Chip 
                label="Link Wallet" 
                onClick={linkWallet}
                color="primary"
              />
            )}
            </Stack>
          </Box>

          <Divider />

          {/* Email Section */}
          <Box>
            <Typography variant="h6" gutterBottom>Email</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ color: 'text.secondary' }}>
                {user?.email?.address || 'No email linked'}
              </Typography>
              {user?.email?.address ? (
                <Chip 
                  label="Update Email" 
                  onClick={updateEmail}
                  color="primary"
                />
              ) : (
                <Chip 
                  label="Link Email" 
                  onClick={linkEmail}
                  color="primary"
                />
              )}
            </Stack>
            {user?.email?.verified === false && (
              <Typography color="warning.main" sx={{ mt: 1 }}>
                Email not verified
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Phone Section */}
          <Box>
            <Typography variant="h6" gutterBottom>Phone</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ color: 'text.secondary' }}>
                {user?.phone?.number || 'No phone linked'}
              </Typography>
              {user?.phone?.number ? (
                <Chip 
                  label="Update Phone" 
                  onClick={updatePhone}
                  color="primary"
                />
              ) : (
                <Chip 
                  label="Link Phone" 
                  onClick={linkPhone}
                  color="primary"
                />
              )}
            </Stack>
            {user?.phone?.verified === false && (
              <Typography color="warning.main" sx={{ mt: 1 }}>
                Phone not verified
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}

export default UserProfile; 