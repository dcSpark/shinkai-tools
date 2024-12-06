use rstest::rstest;
use serde_json::json;
use serde_json::Value;

use crate::tools::{
    code_files::CodeFiles, execution_storage::ExecutionStorage, deno_runner::DenoRunner,
    deno_runner_options::DenoRunnerOptions, execution_context::ExecutionContext,
    runner_type::RunnerType, shinkai_node_location::ShinkaiNodeLocation,
};

use std::collections::HashMap;

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn run_echo_tool(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                async function run(configurations, params) {
                    return { message: "hello world" };
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let deno_runner = DenoRunner::new(
        code_files,
        json!({}),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = deno_runner
        .run(None, json!({}), None)
        .await
        .map_err(|e| {
            log::error!("Failed to run deno code: {}", e);
            e
        })
        .unwrap();

    assert_eq!(result.data.get("message").unwrap(), "hello world");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn run_with_env(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                async function run(configurations, params) {
                   return process.env.HELLO_WORLD;
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };
    let deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let mut envs = HashMap::<String, String>::new();
    envs.insert("HELLO_WORLD".to_string(), "hello world!".to_string()); // Insert the key-value pair
    let result = deno_runner.run(Some(envs), json!({}), None).await.unwrap();

    assert_eq!(result.data.as_str().unwrap(), "hello world!");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn write_forbidden_folder(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                async function run(configurations, params) {
                    try {
                        await Deno.writeTextFile("/test.txt", "This should fail");
                        console.log('write succeeded');
                    } catch (e) {
                        // We expect this to fail due to permissions
                        console.log('error', e);
                        throw e;
                    }
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };
    let deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = deno_runner.run(None, json!({}), None).await.map_err(|e| {
        log::error!("Failed to run deno code: {}", e);
        e
    });
    assert!(result.is_err());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn execution_storage_cache_contains_files(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";

                async function run(configurations, params) {
                    console.log('test');
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let context_id = nanoid::nanoid!();
    // Run the code to ensure dependencies are downloaded
    let deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                context_id: context_id.clone(),
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let _ = deno_runner.run(None, json!({}), None).await.unwrap();

    // Verify cache directory contains files
    let empty_code_files = CodeFiles {
        files: HashMap::new(),
        entrypoint: String::new(),
    };
    let storage = ExecutionStorage::new(
        empty_code_files,
        ExecutionContext {
            context_id,
            ..Default::default()
        },
    );

    log::info!(
        "Deno cache folder: {}",
        storage.cache_folder_path.display()
    );
    assert!(storage.cache_folder_path.exists());
    let cache_files = std::fs::read_dir(&storage.cache_folder_path).unwrap();
    assert!(cache_files.count() > 0);
}

#[rstest]
#[case::host(RunnerType::Host, "127.0.0.2")]
#[case::docker(RunnerType::Docker, "host.docker.internal")]
#[tokio::test]
async fn run_with_shinkai_node_location_host(
    #[case] runner_type: RunnerType,
    #[case] expected_host: String,
) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                async function run(configurations, params) {
                    return process.env.SHINKAI_NODE_LOCATION;
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };
    let deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("https"),
                host: String::from("127.0.0.2"),
                port: 9554,
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = deno_runner.run(None, json!({}), None).await.unwrap();
    assert_eq!(
        result.data.as_str().unwrap(),
        format!("https://{}:9554", expected_host)
    );
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn run_with_file_sub_path(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let code = CodeFiles {
        files: HashMap::from([(
            "potato_a/potato_b/main.ts".to_string(),
            r#"
                async function run(configurations, params) {
                   return "hello world";
                }
            "#
            .to_string(),
        )]),
        entrypoint: "potato_a/potato_b/main.ts".to_string(),
    };
    let deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("https"),
                host: String::from("127.0.0.2"),
                port: 9554,
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = deno_runner.run(None, json!({}), None).await.unwrap();
    assert_eq!(result.data.as_str().unwrap(), "hello world");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn run_with_imports(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([
            (
                "potato_a/potato_b/main.ts".to_string(),
                r#"
                        import { hello } from "../../lorem/ipsum/dolor/importum.ts";
                        async function run(configurations, params) {
                            return hello;
                        }
                "#
                .to_string(),
            ),
            (
                "lorem/ipsum/dolor/importum.ts".to_string(),
                r#"
                        export const hello = 'hello world';
                    "#
                .to_string(),
            ),
        ]),
        entrypoint: "potato_a/potato_b/main.ts".to_string(),
    };
    let deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("https"),
                host: String::from("127.0.0.2"),
                port: 9554,
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = deno_runner.run(None, json!({}), None).await.unwrap();
    assert_eq!(result.data.as_str().unwrap(), "hello world");
}

#[tokio::test]
async fn check_code_success() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
                    // import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
                    async function run() {
                        console.log('test');
                    }
                "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            ..Default::default()
        }),
    );

    let check_result = deno_runner.check().await.unwrap();
    assert_eq!(check_result.len(), 0);
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn check_code_with_errors(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
                    async function run(configurations, params) {
                        console.log('test's);
                    }
                "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            context: ExecutionContext {
                ..Default::default()
            },
            ..Default::default()
        }),
    );

    let check_result = deno_runner.check().await.unwrap();
    assert!(!check_result.is_empty());
    assert!(check_result
        .iter()
        .any(|err| err.contains("Expected ',', got 's'")));
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn check_with_wrong_import_path(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
                import { a } from './potato/a.ts';
                async function run(configurations, params) {
                    console.log('test');
                }
            "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            context: ExecutionContext {
                ..Default::default()
            },
            ..Default::default()
        }),
    );

    let check_result = deno_runner.check().await.unwrap();
    assert!(!check_result.is_empty());
}

#[tokio::test]
async fn check_with_wrong_lib_version() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
                import axios from 'npm:axios@3.4.2';
                async function run(configurations, params) {
                    console.log('test');
                }
            "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(
        code,
        json!({}),
        Some(DenoRunnerOptions {
            ..Default::default()
        }),
    );

    let check_result = deno_runner.check().await.unwrap();
    assert!(!check_result.is_empty());
    assert!(check_result
        .iter()
        .any(|line| line.contains("Could not find npm package 'axios' matching '3.4.2'")));
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn run_tool(#[case] runner_type: RunnerType) {
    // Just for a simple test, it could be any tool
    let code = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../apps/shinkai-tool-echo/src/index.ts"
    ))
    .to_string();

    let code = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let configurations = Value::Null;

    let tool = DenoRunner::new(
        code,
        configurations,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = tool
        .run(
            None,
            serde_json::json!({
                "message": "hello world"
            }),
            None,
        )
        .await
        .unwrap();

    assert_eq!(
        result.data,
        serde_json::json!({ "message": "echoing: hello world"})
    );
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_with_env(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code = r#"
        function run(configurations, params) {
            return { foo: process.env.BAR };
        }
"#;

    let code = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let mut envs = HashMap::<String, String>::new();
    envs.insert("BAR".to_string(), "bar".to_string());
    let run_result = tool
        .run(Some(envs), serde_json::json!({ "name": "world" }), None)
        .await;
    assert!(run_result.is_ok());
    assert_eq!(run_result.unwrap().data["foo"], "bar");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_run_concurrency(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code1 = r#"
        import axios from 'npm:axios';
        async function run(configurations, params) {
            const result = await axios.get('https://jsonplaceholder.typicode.com/todos/1')
                .then(response => {
                    return {
                        status: response.status,
                        data: response.data
                    };
                });
            return result;
        }
    "#;

    let code_files1 = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code1.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let js_code2 = r#"
        import _ from 'npm:lodash';
        function run(configurations, params) {
            return {
                foo: _.add(1, 2)
            };
        }
    "#;

    let code_files2 = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code2.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let js_code3 = r#"
        import { sum } from 'npm:mathjs';
        function run(configurations, params) {
            return {
                foo: sum([1, 2, 3, 4])
            };
        }
    "#;

    let code_files3 = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code3.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let execution_storage = "./shinkai-tools-runner-execution-storage";
    let context_id = String::from("context-patata");
    let execution_id = String::from("2");
    let tool1 = DenoRunner::new(
        code_files1,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.into(),
                execution_id: execution_id.clone(),
                context_id: context_id.clone(),
                code_id: "js_code1".into(),
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let tool2 = DenoRunner::new(
        code_files2,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.into(),
                execution_id: execution_id.clone(),
                context_id: context_id.clone(),
                code_id: "js_code2".into(),
                ..Default::default()
            },
            ..Default::default()
        }),
    );
    let tool3 = DenoRunner::new(
        code_files3,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.into(),
                execution_id: execution_id.clone(),
                context_id: context_id.clone(),
                code_id: "js_code3".into(),
                ..Default::default()
            },
            ..Default::default()
        }),
    );

    let (result1, result2, result3) = tokio::join!(
        tool1.run(None, serde_json::json!({ "name": "world" }), None),
        tool2.run(None, serde_json::Value::Null, None),
        tool3.run(None, serde_json::Value::Null, None)
    );

    let run_result1 = result1.unwrap();
    let run_result2 = result2.unwrap();
    let run_result3 = result3.unwrap();

    assert_eq!(run_result1.data["status"], 200);
    assert_eq!(run_result2.data["foo"], 3);
    assert_eq!(run_result3.data["foo"], 10);
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn file_persistence_in_home(#[case] runner_type: RunnerType) {
    let js_code = r#"
        async function run(c, p) {
            const content = "Hello from tool!";
            console.log("Current directory contents:");
            for await (const entry of Deno.readDir("./")) {
                console.log(entry.name);
            }
            await Deno.writeTextFile(`${process.env.HOME}/test.txt`, content);
            const data = { success: true };
            return data;
        }
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let execution_storage = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("shinkai-tools-runner-execution-storage");
    let context_id = "test-context-id".to_string();

    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                context_id: context_id.clone(),
                code_id: "js_code".into(),
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = tool.run(None, serde_json::Value::Null, None).await.unwrap();
    assert_eq!(result.data["success"], true);

    let file_path = execution_storage.join(format!("{}/home/test.txt", context_id));
    assert!(file_path.exists());
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn mount_file_in_mount(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_file_path = tempfile::NamedTempFile::new().unwrap().into_temp_path();
    std::fs::create_dir_all(test_file_path.parent().unwrap()).unwrap();
    println!("test file path: {:?}", test_file_path);
    std::fs::write(&test_file_path, "1").unwrap();

    let js_code = r#"
        async function run (c, p) {
            const mount = Deno.env.get("MOUNT").split(',');
            for await (const file of mount) {
                console.log("file in mount: ", file);
            }
            const content = await Deno.readTextFile(mount[0]);
            console.log(content);
            return content;
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
            context: ExecutionContext {
                mount_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let mut envs = HashMap::new();
    envs.insert(
        "FILE_NAME".to_string(),
        test_file_path
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string(),
    );
    let result = tool.run(Some(envs), Value::Null, None).await;
    assert!(result.is_ok());
    assert!(result.unwrap().data == "1");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn mount_and_edit_file_in_mount(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_file_path = tempfile::NamedTempFile::new().unwrap().into_temp_path();
    println!("test file path: {:?}", test_file_path);
    std::fs::write(&test_file_path, "1").unwrap();

    let execution_storage = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");

    let js_code = r#"
        async function run (c, p) {
            const mount = Deno.env.get("MOUNT").split(',');
            await Deno.writeTextFile(mount[0], "2");
            return;
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
            context: ExecutionContext {
                storage: execution_storage.clone(),
                mount_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let mut envs = HashMap::new();
    envs.insert(
        "FILE_NAME".to_string(),
        test_file_path
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string(),
    );
    let result = tool.run(Some(envs), Value::Null, None).await;
    assert!(result.is_ok());
    assert!(result.unwrap().data == serde_json::Value::Null);

    let content = std::fs::read_to_string(&test_file_path).unwrap();
    assert_eq!(content, "2");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn mount_file_in_assets(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_file_path = tempfile::NamedTempFile::new().unwrap().into_temp_path();
    println!("test file path: {:?}", test_file_path);
    std::fs::write(&test_file_path, "1").unwrap();

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                async function run (c, p) {
                    const assets = Deno.env.get("ASSETS").split(',');
                    const content = await Deno.readTextFile(assets[0]);
                    console.log(content);
                    return content;
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                assets_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let mut envs = HashMap::new();
    envs.insert(
        "FILE_NAME".to_string(),
        test_file_path
            .to_path_buf()
            .canonicalize()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string(),
    );
    let result = tool.run(Some(envs), Value::Null, None).await;
    assert!(result.is_ok());
    assert!(result.unwrap().data == "1");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn fail_when_try_write_assets(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_file_path =
        tempfile::NamedTempFile::new_in("./shinkai-tools-runner-execution-storage")
            .unwrap()
            .into_temp_path();
    println!("test file path: {:?}", test_file_path);
    std::fs::write(&test_file_path, "1").unwrap();

    let execution_storage = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                async function run (c, p) {
                    const assets = Deno.env.get("ASSETS").split(',');
                    console.log('writing', assets[0]);
                    await Deno.writeTextFile(assets[0], "2");
                    return;
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                code_id: "js_code".into(),
                assets_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let mut envs = HashMap::new();
    envs.insert(
        "FILE_NAME".to_string(),
        test_file_path
            .to_path_buf()
            .canonicalize()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string(),
    );
    let result = tool.run(Some(envs), Value::Null, None).await;
    assert!(result.is_err());
    assert!(result
        .clone()
        .unwrap_err()
        .to_string()
        .contains("NotCapable"));
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn shinkai_tool_param_with_quotes(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code = r#"
        function run(configurations, params) {
            return { 
                single: params.single,
                double: params.double,
                backtick: params.backtick,
                mixed: params.mixed,
                escaped: params.escaped
            };
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
            serde_json::json!({
                "single": "bar's quote",
                "double": "she said \"hello\"",
                "backtick": "using `backticks`",
                "mixed": "single ' and double \" quotes",
                "escaped": "escaped \' and \" quotes"
            }),
            None,
        )
        .await;
    assert!(run_result.is_ok());
    let result = run_result.unwrap().data;
    assert_eq!(result["single"], "bar's quote");
    assert_eq!(result["double"], "she said \"hello\"");
    assert_eq!(result["backtick"], "using `backticks`");
    assert_eq!(result["mixed"], "single ' and double \" quotes");
    assert_eq!(result["escaped"], "escaped \' and \" quotes");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn multiple_file_imports(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let main_code = r#"
        import { helper } from "./helper.ts";
        import { data } from "./data.ts";
        
        function run() {
            return helper(data);
        }
    "#;

    let helper_code = r#"
        export function helper(input: string) {
            return `processed ${input}`;
        }
    "#;

    let data_code = r#"
        export const data = "test data";
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([
            ("main.ts".to_string(), main_code.to_string()),
            ("helper.ts".to_string(), helper_code.to_string()),
            ("data.ts".to_string(), data_code.to_string()),
        ]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code_files,
        Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );
    let result = tool.run(None, Value::Null, None).await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().data, "processed test data");
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn context_and_execution_id(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let context_id = nanoid::nanoid!();
    let execution_id = nanoid::nanoid!();

    let code = r#"
        function run() {
            return {
                contextId: Deno.env.get("CONTEXT_ID"),
                executionId: Deno.env.get("EXECUTION_ID")
            };
        }
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let tool = DenoRunner::new(
        code_files,
        Value::Null,
        Some(DenoRunnerOptions {
            force_runner_type: Some(runner_type),
            context: ExecutionContext {
                context_id: context_id.clone(),
                execution_id: execution_id.clone(),
                ..Default::default()
            },
            ..Default::default()
        }),
    );
    let result = tool.run(None, Value::Null, None).await.unwrap();

    assert_eq!(result.data["contextId"], context_id);
    assert_eq!(result.data["executionId"], execution_id);
}
