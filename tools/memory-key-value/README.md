# Key-Value Memory Management

## Name & Description
A tool that handles memory storage and retrieval using a SQLite database. It manages both general and specific memories, allowing for intelligent memory updates based on new data.

## Usage Example
Use Memory Manager, with data: [YOUR_MEMORY_DATA], and memory_key: [MEMORY_KEY]

## Parameters/Inputs
The following parameters are available (all optional):
- `action` 'upsert' or 'retrive'
- `data` (string, optional): The data to process for memory management. If not provided, the tool will return existing memories
- `memory_key` (string, optional): The key for specific memory retrieval

## Config
- `general_prompt` (string, optional): The general prompt for generating memories
- `specific_prompt` (string, optional): The specific prompt for generating memories
- `database_name` (string, optional)

## Output
The tool returns an object with the following fields:
- `general_memory` (string, required): The updated general memory
- `specific_memory` (string, required): The updated specific memory

Note: Both output fields can be empty strings if no memories are found or if specific memory was not requested (no key provided).
