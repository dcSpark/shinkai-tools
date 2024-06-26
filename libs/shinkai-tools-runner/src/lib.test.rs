use std::path::Path;

use super::*;

#[tokio::test]
async fn shinkai_tool_echo() {
    let tool_path = Path::new("../../dist/apps/shinkai-tool-echo/index.js")
        .canonicalize()
        .unwrap();
    let mut tool = quickjs_runtime::tool::Tool::new();
    let _ = tool.load_from_path(tool_path, "").await;
    let run_result = tool.run("{ \"message\": \"valparaíso\" }").await;
    assert_eq!(run_result.unwrap(), "echoing: valparaíso");
}

#[tokio::test]
async fn shinkai_tool_weather_by_city() {
    let tool_path = Path::new("../../dist/apps/shinkai-tool-weather-by-city/index.js")
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
    let run_result = tool.run("{ \"city\": \"valparaíso\" }").await;
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn shinkai_tool_inline() {
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
    let run_result = tool.run("{ \"name\": \"world\" }").await;
    assert_eq!(run_result.unwrap(), "Hello, world!");
}

#[tokio::test]
async fn shinkai_tool_web3_eth_balance() {
    let tool_path = Path::new("../../dist/apps/shinkai-tool-web3-eth-balance/index.js")
        .canonicalize()
        .unwrap();
    let mut tool = quickjs_runtime::tool::Tool::new();
    let _ = tool.load_from_path(tool_path, "").await;
    let run_result = tool
        .run("{ \"address\": \"0x388c818ca8b9251b393131c08a736a67ccb19297\" }")
        .await;
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn shinkai_tool_web3_eth_uniswap() {
    let tool_path = Path::new("../../dist/apps/shinkai-tool-web3-eth-uniswap/index.js")
        .canonicalize()
        .unwrap();
    let mut tool = quickjs_runtime::tool::Tool::new();
    let _ = tool.load_from_path(tool_path, "").await;
    let run_result = tool
        .run(
            r#"{
    "fromToken": "ETH",
    "toToken": "USDC",
    "amount": "1",
    "fromAddress": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    "toAddress": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    "slippagePercent": 0.5
}"#,
        )
        .await;
    assert!(run_result.is_ok());
}
