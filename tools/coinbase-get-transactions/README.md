# Coinbase Transactions Getter

## Name & Description
A tool for getting the transactions of a Coinbase wallet after restoring it. This tool retrieves transaction history and formats it as a CSV string.

## Usage Example
Use Coinbase Transactions Getter, with name: [YOUR_WALLET_NAME], privateKey: [YOUR_PRIVATE_KEY], and walletId: [YOUR_WALLET_ID]

## Parameters/Inputs
This tool does not require any parameters. The parameters object is empty.

## Config
The following configuration options are available:
- `name` (string, required): The name of the Coinbase wallet
- `privateKey` (string, required): The private key of the Coinbase wallet
- `walletId` (string, required): The ID of the wallet to fetch transactions from

## Output
The tool returns an object with the following fields:
- `tableCsv` (string, required): A CSV-formatted string containing transaction data with the following columns:
  - transferId
  - networkId
  - fromAddressId
  - destinationAddressId
  - assetId
  - amount
  - transactionHash
  - transactionLink
  - status
- `rowsCount` (number, required): The total number of transactions
- `columnsCount` (number, required): The number of columns in the CSV (always 9)
