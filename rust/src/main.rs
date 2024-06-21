use std::path::Path;

mod quickjs_runtime;

#[tokio::main]
async fn main() {
    let tool_path = Path::new("../tools/echo/dist/index.js")
        .canonicalize()
        .unwrap();
    let mut tool = quickjs_runtime::tool::Tool::new();
    tool.load(tool_path).await;
    tool.run("{ \"message\": \"valparaíso\" }").await;
}
