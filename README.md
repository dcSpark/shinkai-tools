# Shinkai Tools 🛠️

A collection of official tools for Shinkai, providing various functionalities from basic examples to advanced search capabilities.

## Overview

This repository hosts a suite of tools designed to work with Shinkai's infrastructure. Each tool is built to provide specific functionality while maintaining security and reliability through Shinkai's sandboxed environment.

## Available Tools

Currently available tools include:

### 1. Email IMAP Fetcher
- Fetches emails from an IMAP server
- Returns subject, date, sender, and text content
- Secure email handling

### 2. Email Sender
- Sends emails using SMTP
- Simple and reliable email dispatch

### 3. Smart Search
- Performs intelligent query optimization
- Returns comprehensive answers with sources
- Advanced search capabilities

And more!

## Tool Spotlight: DuckDuckGo Search

The DuckDuckGo Search tool demonstrates the capabilities and structure of a Shinkai tool:

### Functionality
- Performs web searches using DuckDuckGo
- Supports both API-based and browser-based search methods
- Returns structured results with titles, descriptions, and URLs

### Implementation
- Primary search using DuckDuckGo's API
- Fallback to Puppeteer-based web scraping
- Configurable Chrome path for browser automation

### Required Configuration
```json
{
  "chromePath": "Optional path to Chrome executable"
}
```

### Input Parameters
```json
{
  "message": "Your search query string"
}
```

### Output Format
```json
{
  "message": "[{\"title\": \"Result Title\", \"description\": \"Result Description\", \"url\": \"https://result.url\"}]",
  "puppeteer": false
}
```

## Tool Development Requirements

### Required Files
1. `metadata.json`: Tool configuration and interface definition
2. `tool.ts` or `tool.py`: Implementation code
3. `README.md`: Documentation and usage instructions

### Required Assets
1. Icon Image
   - Dimensions: Must be 1:1 ratio, at least 80x80 pixels
   - Format: PNG
   - Purpose: Tool identification in UI

2. Banner Image
   - Dimensions: Must be 16:9 ratio, at least 1200x676 pixels
   - Format: PNG
   - Purpose: Visual representation in store

## Project Structure
```
tools/
├── tool-example/
│   ├── metadata.json # Tool metadata.
│   ├── README.md # A description of the tool.
│   └── tool.ts # The code of the tool.
├── packages/
│   ├── tool.zip # Zipped contents of the tool.
│   └── directory.json # A listing of the available tools.
```

## Run Tests
```
BEARER_TOKEN=debug SHINKAI_NODE_ADDR="http://0.0.0.0:9550" deno test scripts/ --allow-all
```
