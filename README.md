# Shinkai Tools 🛠️

A collection of official tools for Shinkai, providing various functionalities from basic examples to advanced search capabilities.

## Overview

This repository hosts:
1. A suite of tools designed to work with Shinkai's infrastructure
2. A modern web-based package registry interface to browse and install tools

## Package Registry

The package registry provides a user-friendly interface to:
- Browse available Shinkai tools
- Search tools by name or description
- View tool details including version, author, and hash
- Install tools directly through the Shinkai desktop app

### Features
- Dark mode interface matching Shinkai's design
- Real-time search functionality
- Direct installation via `shinkai://` protocol
- Responsive design for all devices

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