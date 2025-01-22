# Coinbase Wallet Creator

## Name & Description
A tool for creating a Coinbase wallet. This tool creates a new wallet on the BaseSepolia network and returns the wallet's details.

## Usage Example
```typescript
const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  _parameters: Parameters,
): Promise<Result> => {
  // Tool execution
};
```

## Parameters/Inputs
This tool does not require any parameters. The parameters object is empty.

## Config
The following configuration options are available:
- `name` (string, required): The name of the Coinbase wallet
- `privateKey` (string, required): The private key of the Coinbase wallet
- `useServerSigner` (string, optional): Optional flag to use server-side signing. Defaults to "false"

## Output
The tool returns an object with the following optional fields:
- `walletId` (string): The ID of the created wallet
- `seed` (string): The seed phrase for the wallet (only returned if useServerSigner is false)
- `address` (string): The default address of the created wallet
