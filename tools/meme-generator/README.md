# Generate Meme

## Name & Description
A tool that generates a meme based on a joke input. It uses the Imgflip API to create memes by intelligently splitting the joke text and selecting an appropriate meme template.

## Usage Example
Use Meme Generator, with joke: [YOUR_JOKE_TEXT], username: [YOUR_IMGFLIP_USERNAME], and password: [YOUR_IMGFLIP_PASSWORD]

## Parameters/Inputs
The following parameter is required:
- `joke` (string, required): The joke text to be converted into a meme

## Config
The following configuration options are required:
- `username` (string, required): The username for the Imgflip API (e.g., `[YOUR_IMGFLIP_USERNAME]`)
- `password` (string, required): The password for the Imgflip API (e.g., `[YOUR_IMGFLIP_PASSWORD]`)

## Output
The tool returns an object with the following field:
- `memeUrl` (string, required): The URL of the generated meme image
