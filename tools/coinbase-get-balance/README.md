# Coinbase Balance Getter

## Name & Description
A tool for getting the balance of a Coinbase wallet after restoring it. This tool retrieves and displays the token balances for a specified wallet.

## Usage Example
```typescript
const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters,
): Promise<Result> => {
  // Tool execution
};
```

## Parameters/Inputs
The following parameter is available:
- `walletId` (string, optional): Optional wallet ID to get balance for a specific wallet. If not provided in parameters, it must be provided in the configuration.

## Config
The following configuration options are available:
- `name` (string, required): The name of the Coinbase wallet
- `privateKey` (string, required): The private key of the Coinbase wallet
- `walletId` (string, optional): Optional wallet ID for specific wallet selection
- `useServerSigner` (string, optional): Optional server signer configuration

Note: Either the walletId parameter or the walletId configuration must be provided.

## Output
The tool returns an object with the following fields:
- `message` (string, required): Status message about the balance retrieval operation
- `balances` (object, required): Map of token symbols to their respective balances
  - Keys: Token symbols (strings)
  - Values: Balance amounts (numbers)
