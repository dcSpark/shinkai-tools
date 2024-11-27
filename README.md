## Shinkai Tools

[![Mutable.ai Auto Wiki](https://img.shields.io/badge/Auto_Wiki-Mutable.ai-blue)](https://wiki.mutable.ai/dcSpark/shinkai-tools)

Shinkai Tools serves as the ecosystem to execute Shinkai tools, provided by the Shinkai team or third-party developers, in a secure environment. It provides a sandboxed space for executing these tools,
ensuring that they run safely and efficiently, while also allowing for seamless integration with Rust code.

This repository is a comprehensive collection of tools and utilities designed to facilitate the integration of JavaScript and Rust code. It provides a framework for executing Deno scripts within a Rust environment, allowing for seamless communication and data exchange between the two languages.

The primary components of this repository include:

- `apps/shinkai-tool-*` These are small Deno tools designed to perform specific tasks. Each tool is a self-contained project with its own configuration and build process, allowing for easy maintenance and updates.
- `libs/shinkai-tools-builder` type definitions to make tools more readable and easy to code.
- `libs/shinkai-tools-runner` is a Rust library used to execute a tool in a secured and performant Deno environment, providing a safe and efficient way to run tools within the Shinkai ecosystem.

## Documentation

More In Depth Codebase Documentation (Mutable.ai): [https://wiki.mutable.ai/dcSpark/shinkai-tools](https://wiki.mutable.ai/dcSpark/shinkai-tools)

## Getting started

### Init Typescript side

```
# In windows admin privileges is required because rquickjs-sys uses a git patch
npm ci
npx nx run-many -t lint
npx nx run-many -t build
npx nx run-many -t test
```

#### Example Usage

To call a tool from the Rust side, you can use the following example:

```rust
use shinkai_tools_runner::{Tool, CodeFiles};
use serde_json::json;

#[tokio::main]
async fn main() {
    // Define the inline tool's Deno code
    let js_code = r#"
        function run(configurations, params) {
            console.log("Environment variable:", Deno.env.get('MOUNT')); // rw files /path/to/mount1,/path/to/mount2
            console.log("Environment variable:", Deno.env.get('ASSETS')); // ro files /path/to/asset1,/path/to/asset2
            console.log("Environment variable:", Deno.env.get('HOME')); // rw files /path/to/home
            console.log("Environment variable:", Deno.env.get('SHINKAI_NODE_LOCATION')); // https://host.docker.internal:9554 (if it's running in docker) or 127.0.0.2:9554 (if it's running in host)
            return { message: `Echoing: ${params.message}` };
        }
    "#;

    // Set up the code files for the tool
    // It's important to note that the entrypoint must be the name of the file in the `files` map.
    // In this case, the entrypoint is `main.ts` and it's mapped to the `js_code` variable.
    // You can also include other files in the `files` map if your tool needs them.
    let code_files = CodeFiles {
        files: std::collections::HashMap::from([("main.ts".to_string(), js_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    // Create a random file to be used as a mount point. Basically it's a file that could be read/write by the tool
    let test_file_path = tempfile::NamedTempFile::new().unwrap().into_temp_path();
    std::fs::create_dir_all(test_file_path.parent().unwrap()).unwrap();
    println!("test file path: {:?}", test_file_path);
    std::fs::write(&test_file_path, "1").unwrap();

    // Create the tool instance
    let tool = Tool::new(
        code_files,
        json!({}),
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                // Here you specify where the system will store all the files related to execute code
                storage: execution_storage.into(),
                // Here you specify the context id, which is a unique identifier for the execution context.
                // Tools in the same context share the same storage.
                // It creates a folder with the context id and all the files related to the execution are stored in it.
                context_id: context_id.clone(),
                // The execution id is a unique identifier for the execution of the tool
                // It creates logs for every execution and stores them in the storage folder.
                execution_id: execution_id.clone(),
                // The code id is a unique identifier for the code being executed.
                // Used to identify the tools that's logging in the same execution.
                code_id: "js_code1".into(),
                // Here you specify the files that will be mounted with read/write permissions into the Deno execution environment.
                mount_files: vec![test_file_path.to_path_buf().clone()],

                // Here you specify the files that will be mounted with read-only permissions into the Deno execution environment.
                // assets_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
            ..Default::default()
        });

    // Run the tool with input data
    let result = tool.run(None, json!({"message": "Hello, Shinkai!"}), None).await.unwrap();

    // Print the output
    println!("Tool output: {:?}", result.data["message"]); // Echoing: ${params.message}

    // After the execution you can find logs in the storage folder, specifically in storage/{context_id}/logs/{execution_id}_....log
}
```

This example demonstrates how to set up and call a Shinkai tool from Rust, including how to pass input data and handle the output.

## Adding a New Shinkai Tool

To add a new Shinkai tool to this project, follow these simple steps:

1. **Run the Hygen command**: Run `npx hygen shinkai-tool new` to create a new tool. This command will guide you through the process of creating a new tool, including setting up the directory structure and generating the necessary files.

That's it! With this single command, you'll have a new Shinkai tool set up and ready to go.
