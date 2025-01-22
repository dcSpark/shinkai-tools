# Coinbase My Address Getter

## Name & Description
A tool for getting the default address of a Coinbase wallet. This tool retrieves the Ethereum address associated with a specified wallet.

## Usage Example
Use Coinbase My Address Getter, with name: [YOUR_WALLET_NAME], privateKey: [YOUR_PRIVATE_KEY], walletId: [YOUR_WALLET_ID], and useServerSigner: true

## Parameters/Inputs
The following parameter is available:
- `walletId` (string, optional): The ID of the Coinbase wallet to get the address from. If not provided in parameters, it must be provided in the configuration.

## Config
The following configuration options are available:
- `name` (string, required): The name of the Coinbase wallet
- `privateKey` (string, required): The private key of the Coinbase wallet
- `walletId` (string, optional): Optional wallet ID for specific wallet selection
- `useServerSigner` (string, optional): Optional server signer configuration

Note: Either the walletId parameter or the walletId configuration must be provided.

## Output
The tool returns an object with the following field:
- `address` (string, required): The Ethereum address of the Coinbase wallet
