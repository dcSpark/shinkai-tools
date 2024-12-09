use std::collections::HashMap;
use std::env;
use std::time::Duration;

use crate::built_in_tools::get_tool;
use crate::tools::code_files::CodeFiles;
use crate::tools::deno_runner::DenoRunner;
use crate::tools::deno_runner_options::DenoRunnerOptions;
use crate::tools::runner_type::RunnerType;

use rstest::rstest;
use serde_json::json;

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_echo(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-echo").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(None, serde_json::json!({ "message": "valparaíso" }), None)
        .await
        .unwrap();
    assert_eq!(run_result.data["message"], "echoing: valparaíso");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_weather_by_city(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-weather-by-city").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::json!({ "apiKey": "63d35ff6068c3103ccd1227526935675" }),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(None, serde_json::json!({ "city": "valparaíso" }), None)
        .await;
    assert!(run_result.is_ok());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_inline(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code = r#"
        function run(configurations, params) {
            return { message: `Hello, ${params.name}!` };
        }
"#;
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(None, serde_json::json!({ "name": "world" }), None)
        .await
        .unwrap();
    assert_eq!(run_result.data["message"], "Hello, world!");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_inline_non_json_return(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code = r#"
        function run(configurations, params) {
            return 5;
        }
"#;
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool.run(None, serde_json::json!({}), None).await.unwrap();
    assert_eq!(run_result.data, 5);
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_web3_eth_balance(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-web3-eth-balance").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!({ "address": "0x388c818ca8b9251b393131c08a736a67ccb19297" }),
            None,
        )
        .await;
    println!("{}", run_result.as_ref().unwrap().data);
    assert!(run_result.is_ok());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_web3_eth_uniswap(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-web3-eth-uniswap").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
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

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_download_page(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-download-pages").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!({
                "urls": "https://shinkai.com"
            }),
            None,
        )
        .await;
    println!("{}", run_result.as_ref().unwrap().data);
    assert!(run_result.is_ok());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn max_execution_time(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code = r#"
        async function run() {
            let startedAt = Date.now();
            const sleepMs = 100;
            while (true) {
                const elapse = Date.now() - startedAt;
                console.log(`while true sleeping ${sleepMs}ms, elapse ${elapse} ms`);
                await new Promise(async (resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, sleepMs);
                });
            }
            return { data: true };
        }
"#;
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!({ "timeoutMs": 100 }),
            Some(Duration::from_secs(2)),
        )
        .await;
    assert!(run_result.is_err());
    assert!(run_result.err().unwrap().message().contains("timed out"));
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_download_page_stack_overflow(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let managed_thread = std::thread::Builder::new().stack_size(8 * 1024 * 1024);
    let run_result = managed_thread
        .spawn(move || {
            let managed_runtime =
                tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
            managed_runtime.block_on(async {
                let tool_definition = get_tool("shinkai-tool-download-pages").unwrap();
                let code_files = CodeFiles {
                    files: HashMap::from([(
                        "main.ts".to_string(),
                        tool_definition.code.clone().unwrap(),
                    )]),
                    entrypoint: "main.ts".to_string(),
                };
                let tool = DenoRunner::new(
                    code_files,
                    serde_json::Value::Null,
                    Some(DenoRunnerOptions {
                        force_runner_type: Some(runner_type),
                        ..Default::default()
                    }),
                );
                tool.run(
                    None,
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
    println!("run_result: {:?}", run_result);
    assert!(run_result.is_ok());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_leiden(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-leiden").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
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
    let run_result = tool.run(None, params, None).await.unwrap();
    let elapsed_time = start_time.elapsed(); // Measure elapsed time

    println!("Execution time: {:?}", elapsed_time); // Print the elapsed time
    assert!(
        run_result.data["bestClustering"]["nClusters"]
            .as_u64()
            .unwrap()
            > 0
    );
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_duckduckgo_search(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-duckduckgo-search").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
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

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_playwright_example(#[case] runner_type: RunnerType) {
    if cfg!(windows) {
        eprintln!("Skipping test on Windows - Playwright not supported in Deno on Windows");
        return;
    }
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-playwright-example").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code_files,
        if matches!(runner_type, RunnerType::Docker) && std::env::var("CI").is_ok() {
            serde_json::json!({})
        } else {
            serde_json::json!({ "chromePath": std::env::var("CHROME_PATH").ok().unwrap_or("".to_string()) })
        },
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!({
                "url": "https://shinkai.com"
            }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    assert_eq!(
        run_result.unwrap().data["title"]
            .as_str()
            .unwrap()
            .to_string(),
        "Shinkai | Fully Local AI (Models, Files and Agents)".to_string()
    );
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_defillama_lending_tvl_rankings(#[case] runner_type: RunnerType) {
    if matches!(runner_type, RunnerType::Docker) || cfg!(windows) {
        eprintln!("Skipping test in Docker environment or on Windows");
        return;
    }
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-defillama-tvl-rankings").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        if matches!(runner_type, RunnerType::Docker) && std::env::var("CI").is_ok() {
            serde_json::json!({})
        } else {
            serde_json::json!({ "chromePath": std::env::var("CHROME_PATH").ok().unwrap_or("".to_string()) })
        },
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!(      {
              "top10": false,
              "categoryName": "Liquid Staking",
              "networkName": "Ethereum",
            }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    assert_eq!(run_result.unwrap().data["rowsCount"], 43);
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_youtube_summary(#[case] runner_type: RunnerType) {
    if env::var("CI").unwrap_or(String::from("false")) == "true" {
        return;
    }
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-youtube-summary").unwrap();
    let configurations = if env::var("CI").unwrap_or(String::from("false")) == "true" {
        serde_json::json!({ "apiUrl": "https://api.openai.com/v1", "apiKey": env::var("OPEN_AI_API_KEY").unwrap(), "model": "gpt-4o-mini" })
    } else {
        let host = if matches!(runner_type, RunnerType::Docker) {
            "host.docker.internal"
        } else {
            "127.0.0.1"
        };
        serde_json::json!({ "apiUrl": format!("http://{}:11434", host), "lang": "en" })
    };

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        configurations,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!({ "url": "https://www.youtube.com/watch?v=GQ9yRPfsDPk" }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    assert!(!run_result.unwrap().data["summary"]
        .as_str()
        .unwrap()
        .is_empty());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_json_to_md(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-json-to-md").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };
    let tool = DenoRunner::new(
        code_files,
        serde_json::json!({
            "only_system": false
        }),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let message = serde_json::json!({
        "relevantSentencesFromText": [
            {
                "citation_id": 5,
                "document_reference": "[8] http://www.youtube.com/watch?v=eaSIq9c14YE",
                "relevantSentenceFromDocument":
                "This video describes the role of light in plant growth. A comparison of light detection by human eyes and light absorption by plants begins a little bit past the halfway point.",
            },
            {
                "citation_id": 0,
                "document_reference":
                "[6] Arizona Master Gardener Manual, by the University of Arizona College of Agriculture’s Cooperative Extension.",
                "relevantSentenceFromDocument":
                "This online book is a good example of a state-specific resource for learning about what plants need to thrive.",
            },
            {
                "citation_id": 0,
                "document_reference":
                "[6] Arizona Master Gardener Manual, by the University of Arizona College of Agriculture’s Cooperative Extension.",
                "relevantSentenceFromDocument":
                "This online book is a good example of a state-specific resource for learning about what plants need to thrive.",
            },
            {
                "citation_id": 11,
                "document_reference": "[7]",
                "relevantSentenceFromDocument": "",
            },
        ],
        "answer": {
            "brief_introduction": {
                "sentences": [
                "Transplanting a houseplant can be a delicate process that requires careful consideration of the plant’s needs and the conditions provided.",
                "To ensure a successful transplant, it is essential to prepare the new pot and the soil, as well as the plant itself, in advance.",
                "As explained by [0] on the Arizona Master Gardener Manual website,[6] this preparation can help reduce stress on the plant during the transplant process.",
                ],
            },
            "extensive_body": [
                {
                    "sentences": [
                        "Firstly, as [1] describes, plants need light to grow and thrive. But different colors of light have varying effects on their development. For example, scientists on UCSB ScienceLine state that \"red light is often used to boost fruit production in greenhouses, while blue light can be used to increase plant growth\" [3].",
                        "When transplanting a houseplant, it is essential to choose a location with the right amount of light. As [1] explains, \"a comparison of light detection by human eyes and light absorption by plants begins a little bit past the halfway point.\" This means that even if a plant appears healthy in its current environment, it may require more or less light once moved to a new pot.",
                        "In addition to ensuring the right amount of light, it is crucial to prepare the soil properly. According to [10] on Arizona Master Gardener Manual website,[6]",
                        "Furthermore, plants have unique needs and preferences for optimal growth. As [1] notes that \"Plants are able to sense changes in their environment using abilities similar to human sight, touch, smell, taste, and hearing.\" This means that even small changes can affect the plant’s overall well-being.",
                        "To minimize transplant shock, gardeners should also consider the time of year when making a decision to move or transplant any plants. According to [4], it is best to do this during the spring season because this allows most species of deciduous trees and many other woody ornamental woody shrubs including fruit trees to start regrowth without major changes in weather as they usually require.",
                        "In terms of optimal growth conditions, different types of plants have varying requirements when it comes to light. [2] states that \"by using specialized colored filters over light lamps can produce higher plant weights\" which demonstrates the fact various colors used for plants growth at high concentration affect its height length and plant biomass. Various experiments conducted, by some research studies demonstrated 1-2-fold increase of both biomass growth rate as well plant quality in comparison with an equivalent plant grown without such lighting filters.",
                    ],
                },
            ],
            "conclusion": [
                {
                    "sentences": [
                        "In conclusion, transplanting a houseplant requires careful consideration of its needs and the new environment. With this information from state-specific resources like Arizona Master Gardener Manual,[6] gardeners are able to make more informed decisions about optimal growing conditions.",
                        "Moreover, plants respond well-t their environment; as mentioned by Abram, \"Growing Plants from Seed\"[14] which further highlights various factors that should be considered when transplanting a plant.",
                    ],
                },
            ],
        },
    })
    .to_string();
    let run_result = tool
        .run(
            None,
            json!({
                "message": message,
            "template": "# Introduction{%- for sentence in answer.brief_introduction.sentences %}{{ sentence }}{%- endfor %}\\# Body{%- for section in answer.extensive_body %}## Section {{ loop.index }}{%- for sentence in section.sentences %}{{ sentence }}{%- endfor %}{%- endfor %}\\# Conclusion{%- for section in answer.conclusion %}{{ section.sentences[0] }}{%- endfor %}\\# Citations{%- for citation in relevantSentencesFromText %}[{{ citation.citation_id }}]: {{ citation.relevantSentenceFromDocument }}{%- endfor %}"}),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    assert!(!run_result.unwrap().data["message"]
        .as_str()
        .unwrap()
        .is_empty());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_perplexity(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tool_definition = get_tool("shinkai-tool-perplexity").unwrap();
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), tool_definition.code.clone().unwrap())]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code_files,
        if matches!(runner_type, RunnerType::Docker) && std::env::var("CI").is_ok() {
            serde_json::json!({})
        } else {
            serde_json::json!({ "chromePath": std::env::var("CHROME_PATH").ok().unwrap_or("".to_string()) })
        },
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let run_result = tool
        .run(
            None,
            serde_json::json!({
                "query": "what's the roman empire?"
            }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    assert!(!run_result.unwrap().data["response"]
        .as_str()
        .unwrap()
        .to_string()
        .is_empty());
}
