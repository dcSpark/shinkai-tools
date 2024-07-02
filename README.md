## Shinkai Tools

Shinkai Tools serves as the ecosystem to execute Shinkai tools, provided by the Shinkai team or third-party developers, in a secure environment. It provides a sandboxed space for executing these tools, 
ensuring that they run safely and efficiently, while also allowing for seamless integration with Rust code.

This repository is a comprehensive collection of tools and utilities designed to facilitate the integration of JavaScript and Rust code. It provides a framework for executing JavaScript scripts within a Rust environment, allowing for seamless communication and data exchange between the two languages.

The primary components of this repository include:

* `apps/shinkai-tool-*` These are small JavaScript tools designed to perform specific tasks. Each tool is a self-contained project with its own configuration and build process, allowing for easy maintenance and updates.
* `libs/shinkai-tools-builder` is a TypeScript library that provides the necessary classes and types to build new tools, making it easier to create and integrate new tools into the Shinkai ecosystem.
* `libs/shinkai-tools-runner` is a Rust library used to execute a tool in a secured and performant JavaScript environment, providing a safe and efficient way to run tools within the Shinkai ecosystem.

## Getting started

### Init Typescript side
```
# In windows admin privileges is required because rquickjs-sys uses a git patch
npm ci
npx nx run-many -t lint
npx nx run-many -t build
npx nx run-many -t test
```

## How to use a tool from Rust side (using shinkai_tools_runner)

To execute a tool from the Rust side, you can follow these steps:

1. First, ensure that the tool's JavaScript file is located in the correct directory as specified in the `Cargo.toml` file.
2. In your Rust code, import the necessary modules and create a new instance of the `Tool` struct.
3. Load the tool's JavaScript file using the `load` method, passing the path to the file as an argument.
4. Once the tool is loaded, you can call its functions using the `run` method, passing any required arguments as JSON strings.

Here's an example:
```rust
use shinkai_tools_runner::built_in_tools::get_tool;
use shinkai_tools_runner::tools::tool::Tool;

#[tokio::main]
async fn main() {
    let tool_definition = get_tool("shinkai-tool-echo").unwrap();
    let mut tool = Tool::new();
    let _ = tool
        .load_from_code(&tool_definition.code.clone().unwrap(), "")
        .await;
    let run_result = tool.run("{ \"message\": \"new york\" }").await.unwrap();
    assert_eq!(run_result.data["message"], "echoing: new york");
}
```
