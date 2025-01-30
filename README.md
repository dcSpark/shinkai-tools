# Shinkai Tools 🛠️

A collection of official tools for Shinkai, providing various functionalities from basic examples to advanced search capabilities.

## Overview

This repository hosts a suite of tools designed to work with Shinkai's infrastructure. Each tool is built to provide specific functionality while maintaining security and reliability through Shinkai's sandboxed environment.

## Available Tools

Currently available tools include:

### Search & Information
- **Smart Search**: Comprehensive answer generation with source citations and statement extraction
- **DuckDuckGo Search**: Web search functionality with structured results
- **Google Search**: Web search using Google's search engine
- **X/Twitter Search**: Search tweets and user information
- **YouTube Summary**: Generate summaries of YouTube video content
- **Perplexity**: AI-powered search and analysis
- **Perplexity API**: Direct integration with Perplexity's API

### Email & Communication
- **Email IMAP Fetcher**: Secure email retrieval from IMAP servers
- **Email Sender**: SMTP-based email dispatch service
- **Email Responder**: Automated email response generation with context awareness
- **Twitter Post**: Post updates to X/Twitter platform

### File & Data Management
- **File Read**: Secure file reading operations
- **File Write**: File creation and update capabilities
- **File Update**: Modify existing file contents
- **Memory**: SQLite-based memory storage and retrieval
- **Download Page**: Web page content retrieval

### Blockchain & Crypto
- **Coinbase Call Faucet**: Interact with Coinbase faucet
- **Coinbase Create Wallet**: Wallet creation functionality
- **Coinbase Get Balance**: Check wallet balances
- **Coinbase Get My Address**: Retrieve wallet addresses
- **Coinbase Get Transactions**: View transaction history
- **Coinbase Send TX**: Execute transactions

### Media & Content
- **Meme Generator**: Create custom meme images
- **Text-to-Audio Kokoro**: Convert text to audio using Kokoro

## Tool Structure and Required Files

Every Shinkai tool requires specific files to function properly. Here's a detailed look at each required file:

### icon.png
- Square image in PNG format (1:1 ratio)
- Minimum dimensions: 80x80 pixels
- Used for tool identification in the Shinkai UI and Store
- Example: A distinctive icon representing the tool's primary function

### banner.png
- Wide image in PNG format (16:9 ratio)
- Minimum dimensions: 1200x676 pixels
- Used for tool identification in the Shinkai UI and Store
- Example: A real world usage scenario that explains the tool benefits.

### metadata.json
- Defines tool configuration and interface
- Contains version, name, description, and author
- Specifies input parameters and output format
- Example:
```json
{
  "version": "1.0.0",
  "name": "Example Tool",
  "description": "Brief description of the tool's purpose",
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "Description of the input"
      }
    }
  }
}
```

### tool.ts or tool.py
- Main implementation file (TypeScript or Python)
- Contains the core logic and functionality
- Exports a default function that processes inputs
- Example:
```typescript
export default async function(input: string): Promise<string> {
  // Tool implementation
  return processedResult;
}
```

### README.md
- Documentation for tool usage and setup
- Installation and configuration instructions
- Examples of input/output formats
- Any additional requirements or dependencies

## Project Structure
```
tools/
├── tool-example/
│   ├── metadata.json # Tool metadata.
│   ├── README.md # A description of the tool.
│   └── tool.ts # The code of the tool.
│   └── icon.png # Icon of the tool.
│   └── banner.png # Banner of the tool.
```

## Run Tests
```
BEARER_TOKEN=debug SHINKAI_NODE_ADDR="http://0.0.0.0:9550" deno test scripts/ --allow-all
```
