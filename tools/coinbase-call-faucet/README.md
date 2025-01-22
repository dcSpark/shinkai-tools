# Coinbase Faucet Caller

## Name & Description
A tool for calling a faucet on Coinbase. This tool allows you to request test tokens from a faucet for a specified wallet on the BaseSepolia network.

## Usage Example
```typescript
const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  _params: Parameters,
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
- `walletId` (string, optional): Optional wallet ID for specific wallet selection. If not provided, a new wallet will be created.

## Output
The tool returns an object with the following field:
- `data` (string): A message containing the faucet transaction result and wallet address. Example: "Faucet transaction completed successfully: {transaction_details} for wallet: {wallet_address}"
