# Update File with Prompt

## Name & Description
A tool that applies a prompt to modify file contents using an LLM. It reads the target file, processes its content according to the provided instructions, and writes back the updated version.

## Usage Example
```typescript
async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Tool execution
    pass
}
```

## Parameters/Inputs
The following parameters are required:
- `path` (string, required): The path of the file to update
- `prompt` (string, required): The prompt/instructions to apply to the file contents

## Config
This tool does not require any configuration options. The configuration object is empty.

## Output
The tool returns an object with the following fields:
- `new_file_content` (string, required): The updated content of the file after applying the prompt
- `message` (string, required): A status message indicating the result of the operation (e.g., "File updated")
