# List Memory Management

## Name & Description
A tool that handles memory storage and retrieval using a SQLite database. 
It stores data in a list format with unique IDs and timestamps.

## Usage Example
Use Memory Manager with the following parameters:
```typescript
{
  action: 'insert' | 'update' | 'retrieve' | 'retrieve_all' | 'delete',
  data?: string,
  memory_id?: number
}
```

## Parameters/Inputs
The following parameters are available:
- `action` (string, required): The action to perform. Valid values are:
  - 'insert': Add a new memory
  - 'update': Update an existing memory
  - 'retrieve': Get a specific memory or all memories
  - 'retrieve_all': Get all memories
  - 'delete': Delete a specific memory
- `data` (string, optional): The memory content to store or update
- `memory_id` (number, optional): The ID of the memory to retrieve, update, or delete

## Config
- `database_name` (string, optional): Custom name for the SQLite database

## Output
The tool returns an object with the following fields (depending on the action):
- For 'insert' and 'update':
  - `id` (number): The ID of the memory
  - `memory` (string): The stored/updated memory content
- For 'retrieve':
  - If memory_id is provided:
    - `memory` (string): The retrieved memory content
    - `id` (number): The memory ID
  - If no memory_id:
    - `all_memories` (array): List of all memories with their IDs
- For 'retrieve_all':
  - `all_memories` (array): List of all memories with their IDs
- For 'delete':
  - `id` (number): The ID of the deleted memory
  - `memory` (string): Empty string

Note: The database automatically creates a table named 'memory_list_table' if it doesn't exist, with columns for id, date, and memory content.
