## Shinkai Tools

[![Mutable.ai Auto Wiki](https://img.shields.io/badge/Auto_Wiki-Mutable.ai-blue)](https://wiki.mutable.ai/dcSpark/shinkai-tools)

Shinkai Tools serves as the ecosystem to execute Shinkai tools, provided by the Shinkai team or third-party developers, in a secure environment. It provides a sandboxed space for executing these tools, 
ensuring that they run safely and efficiently, while also allowing for seamless integration with Rust code.

This repository is a comprehensive collection of tools and utilities designed to facilitate the integration of JavaScript and Rust code. It provides a framework for executing Deno scripts within a Rust environment, allowing for seamless communication and data exchange between the two languages.

The primary components of this repository include:

* `apps/shinkai-tool-*` These are small Deno tools designed to perform specific tasks. Each tool is a self-contained project with its own configuration and build process, allowing for easy maintenance and updates.
* `libs/shinkai-tools-builder` type definitions to make tools more readable and easy to code.
* `libs/shinkai-tools-runner` is a Rust library used to execute a tool in a secured and performant Deno environment, providing a safe and efficient way to run tools within the Shinkai ecosystem.

## Documentation

General Documentation: [https://docs.shinkai.com](https://docs.shinkai.com)

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
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
        None,
    );
    let run_result = tool
        .run(serde_json::json!({ "message": "valparaíso" }), None)
        .await
        .unwrap();
    println!("{}", run_result.data["message"]);
    // > "Hello, world!"
}
```

Also you can run inline tools. The only needed structure is a run method (it can be sync or async) with two parameters:

```rust
    let js_code = r#"
        function run(configurations, params) {
            return { message: `Hello, ${params.name}!` };
        }
"#;
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null, None);
    let run_result = tool
        .run(serde_json::json!({ "name": "world" }), None)
        .await
        .unwrap();
    println!("{}", run_result.data["message"]);
    // > "Hello, world!"
```

## Adding a New Shinkai Tool

To add a new Shinkai tool to this project, follow these simple steps:

1. **Run the Hygen command**: Run `npx hygen shinkai-tool new` to create a new tool. This command will guide you through the process of creating a new tool, including setting up the directory structure and generating the necessary files.

That's it! With this single command, you'll have a new Shinkai tool set up and ready to go.
