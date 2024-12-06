use std::collections::HashMap;

use crate::tools::runner_type::RunnerType;
use rstest::rstest;
use serde_json::Value;

use crate::tools::execution_context::ExecutionContext;
use crate::tools::python_runner_options::PythonRunnerOptions;
use crate::tools::shinkai_node_location::ShinkaiNodeLocation;
use crate::tools::{code_files::CodeFiles, python_runner::PythonRunner};

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
            "main.py".to_string(),
            r#"
import json

def run(configurations, parameters):
    value = { 'message': 'hello world' }
    return value
            "#
            .to_string(),
        )]),
        entrypoint: "main.py".to_string(),
    };
    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = python_runner
        .run(None, serde_json::Value::Null, None)
        .await
        .map_err(|e| {
            log::error!("Failed to run python code: {}", e);
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

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.py".to_string(),
            r#"
import os
def run(configurations, parameters):
    return os.getenv('HELLO_WORLD')
                "#
            .to_string(),
        )]),
        entrypoint: "main.py".to_string(),
    };
    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let mut envs = HashMap::<String, String>::new();
    envs.insert("HELLO_WORLD".to_string(), "hello world!".to_string()); // Insert the key-value pair
    let result = python_runner
        .run(Some(envs), serde_json::Value::Null, None)
        .await
        .unwrap();

    assert_eq!(result.data.as_str().unwrap(), "hello world!");
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

    let code = r#"
import os
def run(configurations, parameters):
    return os.getenv('SHINKAI_NODE_LOCATION')
            "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("https"),
                host: String::from("127.0.0.2"),
                port: 9554,
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = python_runner
        .run(None, serde_json::Value::Null, None)
        .await
        .unwrap();
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
    let code_files = CodeFiles {
        files: HashMap::from([(
            "potato_a/potato_b/main.py".to_string(),
            r#"
def run(configurations, parameters):
    return "hello world"
        "#
            .to_string(),
        )]),
        entrypoint: "potato_a/potato_b/main.py".to_string(),
    };
    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("https"),
                host: String::from("127.0.0.2"),
                port: 9554,
            },
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = python_runner.run(None, Value::Null, None).await.unwrap();
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

    let code_files = CodeFiles {
        files: HashMap::from([
            (
                "main.py".to_string(),
                r#"
from secondary import hello
def run(configurations, parameters):
    return hello
                "#
                .to_string(),
            ),
            (
                "secondary.py".to_string(),
                r#"
hello = 'hello world'
                "#
                .to_string(),
            ),
        ]),
        entrypoint: "main.py".to_string(),
    };

    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = python_runner.run(None, Value::Null, None).await.unwrap();
    assert_eq!(result.data.as_str().unwrap(), "hello world");
}

#[tokio::test]
async fn check_code_success() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
def run(configurations, parameters):
    return "Hello world from successful test"
                "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            ..Default::default()
        }),
    );

    let check_result = python_runner.check().await.unwrap();
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

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.py".to_string(),
            String::from(
                r#"
print('test's)
                "#,
            ),
        )]),
        entrypoint: "main.py".to_string(),
    };

    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let check_result = python_runner.check().await.unwrap();
    assert!(!check_result.is_empty());
    assert!(check_result
        .iter()
        .any(|err| err.contains("Perhaps you forgot a comma?")));
}

#[rstest]
#[case::host(RunnerType::Host)]
#[case::docker(RunnerType::Docker)]
#[tokio::test]
async fn run_with_import_library(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.py".to_string(),
            r#"
import requests
def run(configurations, parameters):
    response = requests.get('https://httpbin.org/get')
    return response.json()['url']
                "#
            .to_string(),
        )]),
        entrypoint: "main.py".to_string(),
    };

    let python_runner = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
            force_runner_type: Some(runner_type),
            ..Default::default()
        }),
    );

    let result = python_runner
        .run(None, Value::Null, None)
        .await
        .map_err(|e| {
            log::error!("Failed to run python code: {}", e);
            e
        })
        .unwrap();

    assert_eq!(result.data.as_str().unwrap(), "https://httpbin.org/get");
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
import requests
def run(configurations, params):
    response = requests.get('https://jsonplaceholder.typicode.com/todos/1')
    return {
        'status': response.status_code,
        'data': response.json()
    }
    "#;

    let code_files1 = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code1.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let js_code2 = r#"
def run(configurations, params):
    return {
        'foo': 1 + 2
    }
    "#;

    let code_files2 = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code2.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let js_code3 = r#"
def run(configurations, params):
    return {
        'foo': sum([1, 2, 3, 4])
    }
    "#;

    let code_files3 = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), js_code3.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let execution_storage = "./shinkai-tools-runner-execution-storage";
    let context_id = String::from("context-patata");
    let execution_id = String::from("2");
    let tool1 = PythonRunner::new(
        code_files1,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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
    let tool2 = PythonRunner::new(
        code_files2,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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
    let tool3 = PythonRunner::new(
        code_files3,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), r#"
import os
import pathlib

async def run(c, p):
    content = "Hello from tool!"
    print("Current directory contents:")
    for entry in os.listdir("./"):
        print(entry)
    
    home_path = pathlib.Path(os.environ["HOME"]) / "test.txt"
    with open(home_path, "w") as f:
        f.write(content)
    
    data = {"success": True}
    return data
    "#.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let execution_storage = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("shinkai-tools-runner-execution-storage");
    let context_id = "test-context-id".to_string();

    let tool = PythonRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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

    let code_files = CodeFiles {
        files: HashMap::from([("main.py".to_string(), r#"
import os

def run(c, p):
    mount = os.environ["MOUNT"].split(',')
    for file in mount:
        print("file in mount: ", file)
    with open(mount[0]) as f:
        content = f.read()
    print(content)
    return content
"#.to_string())]),
        entrypoint: "main.py".to_string(),
    };

    let tool = PythonRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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

    let code_files = CodeFiles {
        files: HashMap::from([("main.py".to_string(), r#"
import os

def run(c, p):
    mount = os.environ["MOUNT"].split(',')
    with open(mount[0], 'w') as f:
        f.write("2")
    return None
"#.to_string())]),
        entrypoint: "main.py".to_string(),
    };

    let tool = PythonRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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
        files: HashMap::from([("main.py".to_string(), r#"
import os

def run(c, p):
    assets = os.environ["ASSETS"].split(',')
    with open(assets[0]) as f:
        content = f.read()
    print(content)
    return content
"#.to_string())]),
        entrypoint: "main.py".to_string(),
    };

    let tool = PythonRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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
async fn shinkai_tool_param_with_quotes(#[case] runner_type: RunnerType) {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code_files = CodeFiles {
        files: HashMap::from([("main.py".to_string(), r#"
def run(configurations, params):
    return {
        'single': params['single'],
        'double': params['double'],
        'backtick': params['backtick'],
        'mixed': params['mixed'],
        'escaped': params['escaped']
    }
"#.to_string())]),
        entrypoint: "main.py".to_string(),
    };

    let tool = PythonRunner::new(
        code_files,
        serde_json::Value::Null,
        Some(PythonRunnerOptions {
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

    let code_files = CodeFiles {
        files: HashMap::from([
            ("main.py".to_string(), r#"
from helper import helper
from data import data

def run(configurations, params):
    return helper(data)
"#.to_string()),
            ("helper.py".to_string(), r#"
def helper(input):
    return f"processed {input}"
"#.to_string()),
            ("data.py".to_string(), r#"
data = "test data"
"#.to_string()),
        ]),
        entrypoint: "main.py".to_string(),
    };

    let tool = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
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

    let code_files = CodeFiles {
        files: HashMap::from([("main.py".to_string(), r#"
import os

def run(configurations, params):
    return {
        'contextId': os.environ['CONTEXT_ID'],
        'executionId': os.environ['EXECUTION_ID']
    }
"#.to_string())]),
        entrypoint: "main.py".to_string(),
    };

    let tool = PythonRunner::new(
        code_files,
        Value::Null,
        Some(PythonRunnerOptions {
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
