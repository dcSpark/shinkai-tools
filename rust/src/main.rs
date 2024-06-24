use std::path::Path;

mod quickjs_runtime;

#[tokio::main]
async fn main() {
    {
        let tool_path = Path::new("../tools/echo/dist/index.js")
            .canonicalize()
            .unwrap();
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool.load(tool_path, "").await;
        let _ = tool.run("{ \"message\": \"valparaíso\" }").await;
    }
    {
        let tool_path = Path::new("../tools/weather_by_city/dist/index.js")
            .canonicalize()
            .unwrap();
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool.load(tool_path, "{ \"apiKey\": \"63d35ff6068c3103ccd1227526935675\" }").await;
        /*
            You can also call config method
            let _ = tool.config("{ \"apiKey\": \"63d35ff6068c3103ccd1227526935675\" }").await;
        */
        let _ = tool.run("{ \"city\": \"valparaíso\" }").await;
    }
}
