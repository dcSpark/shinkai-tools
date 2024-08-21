use crate::built_in_tools::get_tool;
use crate::tools::tool::Tool;

#[tokio::test]
async fn shinkai_tool_echo() {
    let tool_definition = get_tool("shinkai-tool-echo").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let run_result = tool
        .run(serde_json::json!({ "message": "valparaíso" }), None)
        .await
        .unwrap();
    assert_eq!(run_result.data["message"], "echoing: valparaíso");
}

#[tokio::test]
async fn shinkai_tool_weather_by_city() {
    let tool_definition = get_tool("shinkai-tool-weather-by-city").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::json!({ "apiKey": "63d35ff6068c3103ccd1227526935675" }),
    );
    let run_result = tool
        .run(serde_json::json!({ "city": "valparaíso" }), None)
        .await;
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let run_result = tool
        .run(serde_json::json!({ "name": "world" }), None)
        .await
        .unwrap();
    assert_eq!(run_result.data, "Hello, world!");
}

#[tokio::test]
async fn shinkai_tool_web3_eth_balance() {
    let tool_definition = get_tool("shinkai-tool-web3-eth-balance").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let run_result = tool
        .run(
            serde_json::json!({ "address": "0x388c818ca8b9251b393131c08a736a67ccb19297" }),
            None,
        )
        .await;
    println!("{}", run_result.as_ref().unwrap().data);
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn shinkai_tool_web3_eth_uniswap() {
    let tool_definition = get_tool("shinkai-tool-web3-eth-uniswap").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let run_result = tool
        .run(
            serde_json::json!({
                "fromToken": "ETH",
                "toToken": "USDC",
                "amount": "1",
                "fromAddress": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
                "toAddress": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
                "slippagePercent": 0.5
            }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn shinkai_tool_download_page() {
    let tool_definition = get_tool("shinkai-tool-download-page").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let run_result = tool
        .run(
            serde_json::json!({
                "url": "https://shinkai.com"
            }),
            None,
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let start_time = std::time::Instant::now();
    let _ = tool.run(serde_json::Value::Null, None).await.unwrap();
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let start_time = std::time::Instant::now();
    let run_result = tool.run(serde_json::Value::Null, None).await.unwrap();
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let start_time = std::time::Instant::now();
    let _ = tool.run(serde_json::Value::Null, None).await.unwrap();
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let start_time = std::time::Instant::now();
    let run_result = tool.run(serde_json::Value::Null, None).await.unwrap();
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let start_time = std::time::Instant::now();
    let run_result = tool.run(serde_json::Value::Null, None).await.unwrap();
    let elapsed_time = start_time.elapsed();
    assert!(run_result.data.as_number().unwrap().as_u64().unwrap() <= 11);
    assert!(elapsed_time.as_millis() <= 2050);
}

#[tokio::test]
async fn max_execution_time() {
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
            let startedAt = Date.now();
            while (true) {
                const elapse = Date.now() - startedAt;
                console.log(`while true every ${500}ms, elapse ${elapse} ms`);
                await new Promise(async (resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, 500);
                });
            }

            return { data: true };
        }
    }
    globalThis.tool = { Tool };
"#;
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null);
    let start_time = std::time::Instant::now();
    let run_result = tool.run(serde_json::Value::Null, Some(10000)).await;
    let elapsed_time = start_time.elapsed();
    assert!(run_result.is_err());
    assert!(elapsed_time.as_millis() <= 10050);
    assert!(run_result.err().unwrap().message().contains("time reached"));
}

#[tokio::test]
async fn shinkai_tool_download_page_stack_overflow() {
    let managed_thread = std::thread::Builder::new().stack_size(8 * 1024 * 1024);
    let run_result = managed_thread
        .spawn(move || {
            let managed_runtime =
                tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
            managed_runtime.block_on(async {
                let tool_definition = get_tool("shinkai-tool-download-page").unwrap();
                let mut tool = Tool::new(
                    tool_definition.code.clone().unwrap(),
                    serde_json::Value::Null,
                );
                tool.run(
                    serde_json::json!({
                        "url": "https://en.wikipedia.org/wiki/Prospect_Park_(Brooklyn)"
                    }),
                    None,
                )
                .await
            })
        })
        .unwrap()
        .join()
        .unwrap();
    assert!(run_result.is_ok());
}

#[tokio::test]
async fn shinkai_tool_leiden() {
    let tool_definition = get_tool("shinkai-tool-leiden").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let edges = vec![
        (2, 1, 1),
        (3, 1, 1),
        (3, 2, 1),
        (4, 1, 1),
        (4, 2, 1),
        (4, 3, 1),
        (5, 1, 1),
        (6, 1, 1),
        (7, 1, 1),
        (7, 5, 1),
        (7, 6, 1),
        (8, 1, 1),
        (8, 2, 1),
        (8, 3, 1),
        (8, 4, 1),
        (9, 1, 1),
        (9, 3, 1),
        (10, 3, 1),
        (11, 1, 1),
        (11, 5, 1),
        (11, 6, 1),
        (12, 1, 1),
        (13, 1, 1),
        (13, 4, 1),
        (14, 1, 1),
        (14, 2, 1),
        (14, 3, 1),
        (14, 4, 1),
        (17, 6, 1),
        (17, 7, 1),
        (18, 1, 1),
        (18, 2, 1),
        (20, 1, 1),
        (20, 2, 1),
        (22, 1, 1),
        (22, 2, 1),
        (26, 24, 1),
        (26, 25, 1),
        (28, 3, 1),
        (28, 24, 1),
        (28, 25, 1),
        (29, 3, 1),
        (30, 24, 1),
        (30, 27, 1),
        (31, 2, 1),
        (31, 9, 1),
        (32, 1, 1),
        (32, 25, 1),
        (32, 26, 1),
        (32, 29, 1),
        (33, 3, 1),
        (33, 9, 1),
        (33, 15, 1),
        (33, 16, 1),
        (33, 19, 1),
        (33, 21, 1),
        (33, 23, 1),
        (33, 24, 1),
        (33, 30, 1),
        (33, 31, 1),
        (33, 32, 1),
        (34, 9, 1),
        (34, 10, 1),
        (34, 14, 1),
        (34, 15, 1),
        (34, 16, 1),
        (34, 19, 1),
        (34, 20, 1),
        (34, 21, 1),
        (34, 23, 1),
        (34, 24, 1),
        (34, 27, 1),
        (34, 28, 1),
        (34, 29, 1),
        (34, 30, 1),
        (34, 31, 1),
        (34, 32, 1),
        (34, 33, 1),
    ];
    let params = serde_json::json!({
      "edges": edges
    });
    let start_time = std::time::Instant::now(); // Start measuring time
    let run_result = tool.run(params, None).await.unwrap();
    let elapsed_time = start_time.elapsed(); // Measure elapsed time

    println!("Execution time: {:?}", elapsed_time); // Print the elapsed time
    assert!(
        run_result.data["bestClustering"]["nClusters"]
            .as_u64()
            .unwrap()
            > 0
    );
}

#[tokio::test]
async fn shinkai_tool_duckduckgo_search() {
    let tool_definition = get_tool("shinkai-tool-duckduckgo-search").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let run_result = tool
        .run(
            serde_json::json!({ "message": "best movie of all time" }),
            None,
        )
        .await
        .unwrap();
    eprintln!("result: {:?}", run_result.data);
    let message = run_result.data["message"].as_str().unwrap();
    let search_results: Vec<serde_json::Value> = serde_json::from_str(message).unwrap();

    // assert!(search_results.is_array());
    assert!(!search_results.is_empty());
    assert!(search_results[0].get("title").is_some());
    assert!(search_results[0].get("url").is_some());
    assert!(search_results[0].get("description").is_some());
}

#[tokio::test]
async fn shinkai_tool_playwright_example() {
    let tool_definition = get_tool("shinkai-tool-playwright-example").unwrap();
    let tool = Tool::new(
        tool_definition.code.clone().unwrap(),
        serde_json::Value::Null,
    );
    let run_result = tool
        .run(
            serde_json::json!({
                "url": "https://shinkai.com"
            }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    assert_eq!(
        run_result.unwrap().data["title"].as_str().unwrap().to_string(),
        "Shinkai | Fully Local AI (Models, Files and Agents)".to_string()
    );
}
