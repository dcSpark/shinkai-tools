use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use serde_json::Value;

use crate::tools::{
    deno_runner_options::DenoRunnerOptions, execution_context::ExecutionContext, tool::Tool,
};

#[tokio::test]
async fn get_tool_definition() {
    // Just for a simple test, it could be any tool
    let code = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../apps/shinkai-tool-echo/src/index.ts"
    ))
    .to_string();
    let configurations = serde_json::json!({});

    let tool = Tool::new(code, configurations, None);

    let definition = tool.definition().await.unwrap();

    assert_eq!(definition.id, "shinkai-tool-echo");
}

#[tokio::test]
async fn run_tool() {
    // Just for a simple test, it could be any tool
    let code = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../apps/shinkai-tool-echo/src/index.ts"
    ))
    .to_string();
    let configurations = Value::Null;

    let tool = Tool::new(code, configurations, None);

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

#[tokio::test]
async fn shinkai_tool_with_env() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let js_code = r#"
        function run(configurations, params) {
            return { foo: process.env.BAR };
        }
"#;
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null, None);
    let mut envs = HashMap::<String, String>::new();
    envs.insert("BAR".to_string(), "bar".to_string());
    let run_result = tool
        .run(Some(envs), serde_json::json!({ "name": "world" }), None)
        .await;
    assert!(run_result.is_ok());
    assert_eq!(run_result.unwrap().data["foo"], "bar");
}

#[tokio::test]
async fn shinkai_tool_run_concurrency() {
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
    let js_code2 = r#"
        import _ from 'npm:lodash';
        function run(configurations, params) {
            return {
                foo: _.add(1, 2)
            };
        }
    "#;

    let js_code3 = r#"
        import { sum } from 'npm:mathjs';
        function run(configurations, params) {
            return {
                foo: sum([1, 2, 3, 4])
            };
        }
    "#;

    let execution_storage = "./shinkai-tools-runner-execution-storage";
    let context_id = String::from("context-patata");
    let execution_id = String::from("2");
    let tool1 = Tool::new(
        js_code1.to_string(),
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.into(),
                execution_id: execution_id.clone(),
                context_id: context_id.clone(),
                code_id: "js_code1".into(),
                ..Default::default()
            },
            ..Default::default()
        }),
    );
    let tool2 = Tool::new(
        js_code2.to_string(),
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
    let tool3 = Tool::new(
        js_code3.to_string(),
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

#[tokio::test]
async fn test_file_persistence_in_home() {
    let js_code = r#"
        async function run(c, p) {
            const content = "Hello from tool!";
            console.log("Current directory contents:");
            for await (const entry of Deno.readDir("./")) {
                console.log(entry.name);
            }
            await Deno.writeTextFile("./home/test.txt", content);
            const data = { success: true };
            return data;
        }
    "#;

    let execution_storage = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("shinkai-tools-runner-execution-storage");
    let context_id = "test-context-id".to_string();

    let tool = Tool::new(
        js_code.to_string(),
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                context_id: context_id.clone(),
                code_id: "js_code".into(),
                ..Default::default()
            },
            ..Default::default()
        }),
    );

    let result = tool.run(None, serde_json::Value::Null, None).await.unwrap();
    assert_eq!(result.data["success"], true);

    let file_path = execution_storage.join(format!("{}/home/test.txt", context_id));
    assert!(file_path.exists());
}

#[tokio::test]
async fn test_mount_file_in_mount() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_file_path = PathBuf::from(format!(
        "././shinkai-tools-runner-execution-storage/temp-test-files/{}",
        nanoid::nanoid!()
    ));
    std::fs::create_dir_all(test_file_path.parent().unwrap()).unwrap();
    println!("test file path: {:?}", test_file_path);
    std::fs::write(&test_file_path, "1").unwrap();

    let execution_storage = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");

    let js_code = r#"
        async function run (c, p) {
            const files = [];
            for await (const dirEntry of Deno.readDir("./mount")) {
                files.push(dirEntry.name);
            }
            console.log("files in mount:", files);
            const content = await Deno.readTextFile(`./mount/${process.env.FILE_NAME}`);
            console.log(content);
            return content;
        }
    "#;

    let tool = Tool::new(
        js_code.to_string(),
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                mount_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
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

#[tokio::test]
async fn test_mount_and_edit_file_in_mount() {
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
            await Deno.writeTextFile(`./mount/${process.env.FILE_NAME}`, "2");
            return;
        }
    "#;

    let tool = Tool::new(
        js_code.to_string(),
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                mount_files: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
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

#[tokio::test]
async fn test_mount_file_in_assets() {
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
            const content = await Deno.readTextFile(`./assets/${process.env.FILE_NAME}`);
            console.log(content);
            return content;
        }
    "#;

    let tool = Tool::new(
        js_code.to_string(),
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                assets: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
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

#[tokio::test]
async fn test_fail_when_try_write_assets() {
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
            await Deno.writeTextFile(`./assets/${process.env.FILE_NAME}`);
            return;
        }
    "#;

    let context_id = format!("test-mount-file-in-assets-{}", nanoid::nanoid!());
    let tool = Tool::new(
        js_code.to_string(),
        serde_json::Value::Null,
        Some(DenoRunnerOptions {
            context: ExecutionContext {
                storage: execution_storage.clone(),
                context_id: context_id.clone(),
                code_id: "js_code".into(),
                assets: vec![test_file_path.to_path_buf().clone()],
                ..Default::default()
            },
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
    assert!(result.is_err());
}

#[tokio::test]
async fn shinkai_tool_param_with_quotes() {
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
    let tool = Tool::new(js_code.to_string(), serde_json::Value::Null, None);
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
