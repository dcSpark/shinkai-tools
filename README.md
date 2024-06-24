## Shinkai Tool Playground

This repository serves as the ecosystem to execute Shinkai tools, provided by the Shinkai team or third-party developers, in a secure environment. It provides a sandboxed space for executing these tools, ensuring that they run safely and efficiently, while also allowing for seamless integration with Rust code.

This repository is a collection of tools and utilities designed to facilitate the integration of JavaScript and Rust code. It provides a framework for executing JavaScript scripts within a Rust environment, allowing for seamless communication and data exchange between the two languages.

The repository includes a set of tools and examples that demonstrate how to load, execute, and interact with JavaScript scripts from Rust. This enables developers to leverage the strengths of both languages, combining the performance and safety of Rust with the dynamic nature and versatility of JavaScript.

The primary components of this repository include:

1. **QuickJS Runtime**: A Rust library that provides a runtime environment for executing JavaScript scripts. It allows for the creation of a JavaScript context, loading of scripts, and execution of functions with support for asynchronous operations.
2. **Tool Framework**: A set of Rust modules that facilitate the creation and management of tools that can be executed from Rust. This includes loading and running JavaScript scripts, as well as providing a way to pass arguments and receive results.
3. **Examples and Utilities**: A collection of examples and utility scripts that demonstrate how to use the QuickJS Runtime and Tool Framework. These examples cover various scenarios, such as executing scripts, calling functions, and handling errors.

## Getting started

### Init Typescript side
```
cd ts/ && npm ci
cd tools/echo/ && npm ci && npm run build
cd tools/weather_by_city/ && npm ci && npm run build
```

### Init Rust side
```
# This requires admin privileges on windows because rquickjs applies a git patch for compatibility
cd rust/ && cargo build && cargo run
```

## How to use a tool from Rust side

To execute a tool from the Rust side, you can follow these steps:

1. First, ensure that the tool's JavaScript file is located in the correct directory as specified in the `Cargo.toml` file.
2. In your Rust code, import the necessary modules and create a new instance of the `Tool` struct.
3. Load the tool's JavaScript file using the `load` method, passing the path to the file as an argument.
4. Once the tool is loaded, you can call its functions using the `run` method, passing any required arguments as JSON strings.

Here's an example:
```rust
use crate::quickjs_runtime::tool::Tool;
use std::path::Path;

#[tokio::main]
async fn main() {
    let tool_path = Path::new("../tools/echo/dist/index.js")
        .canonicalize()
        .unwrap();
    let mut tool = quickjs_runtime::tool::Tool::new();
    let _ = tool.load(tool_path, "").await;
    let _ = tool.run("{ \"message\": \"valparaíso\" }").await;
}
```
