use std::path::Path;

mod quickjs_runtime;

#[tokio::main]
async fn main() {
    {
        let tool_path = Path::new("../tools/echo/dist/index.js")
            .canonicalize()
            .unwrap();
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool.load_from_path(tool_path, "").await;
        let _ = tool.run("{ \"message\": \"valparaíso\" }").await;
    }
    {
        let tool_path = Path::new("../tools/weather_by_city/dist/index.js")
            .canonicalize()
            .unwrap();
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool
            .load_from_path(
                tool_path,
                "{ \"apiKey\": \"63d35ff6068c3103ccd1227526935675\" }",
            )
            .await;
        /*
            You can also call config method
            let _ = tool.config("{ \"apiKey\": \"63d35ff6068c3103ccd1227526935675\" }").await;
        */
        let _ = tool.run("{ \"city\": \"valparaíso\" }").await;
    }
    {
        let js_code = r#"
        class BaseTool {
            constructor(config) {
                this.config = config;
            }
            setConfig(value) {
                this.config = value;
                return this.config;
            }
            getConfig() {
                return this.config;
            }
        }
    
        class Tool extends BaseTool {
            constructor(config) {
                super(config);
            }
            async run(params) {
                return `Hello, ${params.name}!`;
            }
        }
    
        globalThis.tool = { Tool };
    "#;
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool.load_from_code(js_code, "").await;
        let _ = tool.run("{ \"name\": \"world\" }").await;
    }
}
