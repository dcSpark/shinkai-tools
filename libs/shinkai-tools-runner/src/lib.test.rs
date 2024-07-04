use crate::built_in_tools::get_tool;
use crate::tools::tool::Tool;

#[tokio::test]
async fn shinkai_tool_echo() {
    let tool_definition = get_tool("shinkai-tool-echo").unwrap();
    let mut tool = Tool::new();
    let _ = tool
        .load_from_code(&tool_definition.code.clone().unwrap(), "")
        .await;
    let run_result = tool.run("{ \"message\": \"valparaíso\" }").await.unwrap();
    assert_eq!(run_result.data["message"], "echoing: valparaíso");
}

#[tokio::test]
async fn shinkai_tool_weather_by_city() {
    let tool_definition = get_tool("shinkai-tool-weather-by-city").unwrap();
    let mut tool = Tool::new();
    let _ = tool
        .load_from_code(
            &tool_definition.code.clone().unwrap(),
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
            return { data: `Hello, ${params.name}!` };
        }
    }

    globalThis.tool = { Tool };
"#;
    let mut tool = Tool::new();
    let _ = tool.load_from_code(js_code, "").await;
    let run_result = tool.run("{ \"name\": \"world\" }").await.unwrap();
    assert_eq!(run_result.data, "Hello, world!");
}

#[tokio::test]
async fn shinkai_tool_web3_eth_balance() {
    let tool_definition = get_tool("shinkai-tool-web3-eth-balance").unwrap();
    let mut tool = Tool::new();
    let _ = tool
        .load_from_code(&tool_definition.code.clone().unwrap(), "")
        .await;
    let run_result = tool
        .run("{ \"address\": \"0x388c818ca8b9251b393131c08a736a67ccb19297\" }")
        .await;
    println!("{}", run_result.as_ref().unwrap().data);
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn shinkai_tool_web3_eth_uniswap() {
    let tool_definition = get_tool("shinkai-tool-web3-eth-uniswap").unwrap();
    let mut tool = Tool::new();
    let _ = tool
        .load_from_code(&tool_definition.code.clone().unwrap(), "")
        .await;
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

#[tokio::test]
async fn shinkai_tool_download_page() {
    let tool_definition = get_tool("shinkai-tool-download-page").unwrap();
    let mut tool = Tool::new();
    let _ = tool
        .load_from_code(&tool_definition.code.clone().unwrap(), "")
        .await;
    let run_result = tool
        .run(
            r#"{
                "url": "https://shinkai.com"
            }"#,
        )
        .await;
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn set_timeout() {
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
        async run() {
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });
            return { data: null };
        }
    }
    globalThis.tool = { Tool };
"#;
    let mut tool = Tool::new();
    let _ = tool.load_from_code(js_code, "").await;
    let start_time = std::time::Instant::now();
    let _ = tool.run("").await.unwrap();
    let elapsed_time = start_time.elapsed();
    assert!(elapsed_time.as_millis() > 3000);
}

#[tokio::test]
async fn set_timeout_no_delay_param() {
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
        async run() {
            let value = null;
            await new Promise((resolve) => {
                setTimeout(() => {
                    value = 1;
                    resolve();
                });
            });
            return { data: value };
        }
    }
    globalThis.tool = { Tool };
"#;
    let mut tool = Tool::new();
    let _ = tool.load_from_code(js_code, "").await;
    let start_time = std::time::Instant::now();
    let run_result = tool.run("").await.unwrap();
    let elapsed_time = start_time.elapsed();
    assert!(elapsed_time.as_millis() <= 50);
    assert_eq!(run_result.data, 1);
}

#[tokio::test]
async fn clear_timeout() {
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
        async run() {
            await new Promise((resolve) => {
                const cancelation = setTimeout(() => {
                    console.log('after 3s');
                    resolve();
                }, 3000);

                setTimeout(() => {
                    console.log('cancelling at 1.5s');
                    clearTimeout(cancelation);
                    resolve();
                }, 1500);
            });
            return { data: null };
        }
    }
    globalThis.tool = { Tool };
"#;
    let mut tool = Tool::new();
    let _ = tool.load_from_code(js_code, "").await;
    let start_time = std::time::Instant::now();
    let _ = tool.run("").await.unwrap();
    let elapsed_time = start_time.elapsed();
    assert!(elapsed_time.as_millis() >= 1500 && elapsed_time.as_millis() <= 1550);
}

#[tokio::test]
async fn set_interval() {
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
        async run() {
            const i = await new Promise((resolve) => {
                let count = 0;
                setInterval(() => {
                    console.log('set interval' + count);
                    count = count + 1;
                    if (count === 5) {
                        resolve(count);
                    }
                }, 100);
            });
            return { data: i };

        }
    }
    globalThis.tool = { Tool };
"#;
    let mut tool = Tool::new();
    let _ = tool.load_from_code(js_code, "").await;
    let start_time = std::time::Instant::now();
    let run_result = tool.run("").await.unwrap();
    let elapsed_time = start_time.elapsed();
    assert_eq!(run_result.data, 5);
    assert!(elapsed_time.as_millis() <= 1100);
}

#[tokio::test]
async fn clear_interval() {
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
        async run() {
            let count = 0;
            const cancellation = setInterval(() => {
                console.log('set interval ' + count);
                count = count + 1;
            }, 100);

            setTimeout(() => {
                console.log('calling clear interval ' + count);
                clearInterval(cancellation);
            }, 1000);

            await new Promise((resolve) => {
                setTimeout(() => {
                    console.log('promise resolved ' + count);
                    resolve();
                }, 2000);
            });
            return { data: count };
        }
    }
    globalThis.tool = { Tool };
"#;
    let mut tool = Tool::new();
    let _ = tool.load_from_code(js_code, "").await;
    let start_time = std::time::Instant::now();
    let run_result = tool.run("").await.unwrap();
    let elapsed_time = start_time.elapsed();
    assert!(run_result.data.as_number().unwrap().as_u64().unwrap() <= 11);
    assert!(elapsed_time.as_millis() <= 2050);
}
