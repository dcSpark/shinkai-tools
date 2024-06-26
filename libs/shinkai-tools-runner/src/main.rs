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
    {
        let tool_path = Path::new("../tools/web3_eth_balance/dist/index.js")
            .canonicalize()
            .unwrap();
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool.load_from_path(tool_path, "").await;
        let _ = tool
            .run("{ \"address\": \"0x388c818ca8b9251b393131c08a736a67ccb19297\" }")
            .await;
    }
    {
        let tool_path = Path::new("../tools/web3_eth_uniswap/dist/index.js")
            .canonicalize()
            .unwrap();
        let mut tool = quickjs_runtime::tool::Tool::new();
        let _ = tool.load_from_path(tool_path, "").await;
        let _ = tool.run(r#"{
            "fromToken": "ETH",
            "toToken": "USDC",
            "amount": "1",
            "fromAddress": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
            "toAddress": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
            "slippagePercent": 0.5
        }"#).await;
    }
}
