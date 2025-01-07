import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import config from './config';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
    <PrivyProvider
      appId={config.PRIVY_APP_ID}
      config={{
        // Display email and wallet as login methods
        // loginMethods: ['email', 'wallet', 'phone'],
        // Customize Privy's appearance in your app
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
          logo: '/shinkai-logo.png',
        },
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: 'off',
          priceDisplay: {primary: 'fiat-currency', secondary: 'native-token'},
          extendedCalldataDecoding: true,
          waitForTransactionConfirmation: true,
          showWalletUIs: true,
        },
      }}
    >
      <App />
    </PrivyProvider>
    </BrowserRouter>
  </React.StrictMode>
);