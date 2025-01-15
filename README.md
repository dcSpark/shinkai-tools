# Shinkai Tools 🛠️

A collection of official tools for Shinkai, providing various functionalities from basic examples to advanced search capabilities.

## Overview

This repository hosts a suite of tools designed to work with Shinkai's infrastructure

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
