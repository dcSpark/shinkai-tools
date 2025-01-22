# Write File Contents

## Name & Description
A tool that writes text content to a file at the specified path. It provides simple file writing functionality with error handling.

## Usage Example
```typescript
async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Tool execution
    pass
}
```

## Parameters/Inputs
The following parameters are required:
- `path` (string, required): The path of the file to write to
- `content` (string, required): The content to write to the file

## Config
This tool does not require any configuration options. The configuration object is empty.

## Output
The tool returns an object with the following field:
- `message` (string, required): A status message indicating the result of the operation (e.g., "File written" on success, or an error message on failure)
