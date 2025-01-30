# Coinbase Transaction Sender

## Name & Description
A tool for restoring a Coinbase wallet and sending a transaction. This tool allows you to send tokens from a specified wallet to a destination address.

## Usage Example
Use Coinbase Transaction Sender, with name: [YOUR_WALLET_NAME], privateKey: [YOUR_PRIVATE_KEY], recipient_address: [RECIPIENT_ADDRESS], assetId: [ASSET_ID], amount: [AMOUNT], and useServerSigner: [SERVER_SIGNER_VALUE]

## Parameters/Inputs
The following parameters are required:
- `recipient_address` (string, required): The destination address for the transaction
- `assetId` (string, required): The ID of the asset/token to send
- `amount` (string, required): The amount of tokens to send

## Config
The following configuration options are available:
- `name` (string, required): The name of the Coinbase wallet
- `privateKey` (string, required): The private key of the Coinbase wallet
- `walletId` (string, optional): Optional wallet ID for specific wallet selection
- `seed` (string, optional): Optional seed phrase for wallet recovery
- `useServerSigner` (string, optional): Optional flag to use server-side signing. Defaults to "false"

Note: Either seed must be provided or useServerSigner must be true, but not both.

## Output
The tool returns an object with the following fields:
- `transactionHash` (string, required): The hash of the completed transaction
- `transactionLink` (string, required): A link to view the transaction on a block explorer
- `status` (string, required): The status of the transaction (e.g., 'success', 'pending', 'failed')
