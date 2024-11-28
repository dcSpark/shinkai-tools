use rstest::rstest;

use crate::tools::{
    code_files::CodeFiles,
    deno_execution_storage::DenoExecutionStorage,
    deno_runner::DenoRunner,
    deno_runner_options::{DenoRunnerOptions, RunnerType, ShinkaiNodeLocation},
    execution_context::ExecutionContext,
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

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        force_runner_type: Some(runner_type),
        ..Default::default()
    });

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
      console.log('{"message":"hello world"}');
    "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };
    let result = deno_runner
        .run(code_files, None, None)
        .await
        .map_err(|e| {
            log::error!("Failed to run deno code: {}", e);
            e
        })
        .unwrap();

    assert_eq!(result.first().unwrap(), "{\"message\":\"hello world\"}");
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

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        force_runner_type: Some(runner_type),
        ..Default::default()
    });

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
      console.log(process.env.HELLO_WORLD);
    "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };
    let mut envs = HashMap::<String, String>::new();
    envs.insert("HELLO_WORLD".to_string(), "hello world!".to_string()); // Insert the key-value pair
    let result = deno_runner.run(code_files, Some(envs), None).await.unwrap();

    assert_eq!(result.first().unwrap(), "hello world!");
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

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        force_runner_type: Some(runner_type),
        ..Default::default()
    });

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                try {
                    await Deno.writeTextFile("/test.txt", "This should fail");
                    console.log('write succeeded');
                } catch (e) {
                    // We expect this to fail due to permissions
                    console.log('error', e);
                    throw e;
                }
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let result = deno_runner.run(code_files, None, None).await.map_err(|e| {
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

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            r#"
                import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
                console.log('test');
            "#
            .to_string(),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    let context_id = nanoid::nanoid!();
    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        context: ExecutionContext {
            context_id: context_id.clone(),
            ..Default::default()
        },
        force_runner_type: Some(runner_type),
        ..Default::default()
    });

    let _ = deno_runner.run(code_files, None, None).await.unwrap();

    // Verify cache directory contains files
    let empty_code_files = CodeFiles {
        files: HashMap::new(),
        entrypoint: String::new(),
    };
    let storage = DenoExecutionStorage::new(
        empty_code_files,
        ExecutionContext {
            context_id,
            ..Default::default()
        },
    );

    log::info!(
        "Deno cache folder: {}",
        storage.deno_cache_folder_path.display()
    );
    assert!(storage.deno_cache_folder_path.exists());
    let cache_files = std::fs::read_dir(&storage.deno_cache_folder_path).unwrap();
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

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        shinkai_node_location: ShinkaiNodeLocation {
            protocol: String::from("https"),
            host: String::from("127.0.0.2"),
            port: 9554,
        },
        force_runner_type: Some(runner_type),
        ..Default::default()
    });
    let code = r#"
      console.log(process.env.SHINKAI_NODE_LOCATION);
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };
    let result = deno_runner.run(code_files, None, None).await.unwrap();
    assert_eq!(
        result.first().unwrap().as_str(),
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

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        shinkai_node_location: ShinkaiNodeLocation {
            protocol: String::from("https"),
            host: String::from("127.0.0.2"),
            port: 9554,
        },
        force_runner_type: Some(runner_type),
        ..Default::default()
    });
    let code = r#"
      console.log("hello world");
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("potato_a/potato_b/main.ts".to_string(), code.to_string())]),
        entrypoint: "potato_a/potato_b/main.ts".to_string(),
    };
    let result = deno_runner.run(code_files, None, None).await.unwrap();
    assert_eq!(result.first().unwrap(), "hello world");
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

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        shinkai_node_location: ShinkaiNodeLocation {
            protocol: String::from("https"),
            host: String::from("127.0.0.2"),
            port: 9554,
        },
        force_runner_type: Some(runner_type),
        ..Default::default()
    });

    let code_files = CodeFiles {
        files: HashMap::from([
            (
                "potato_a/potato_b/main.ts".to_string(),
                r#"
                    import { hello } from "../../lorem/ipsum/dolor/importum.ts";
                    console.log(hello);
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
    let result = deno_runner.run(code_files, None, None).await.unwrap();
    assert_eq!(result.first().unwrap(), "hello world");
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
                    // import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
                    console.log('test');
                "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        ..Default::default()
    });

    let check_result = deno_runner.check(code_files).await.unwrap();
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
            "main.ts".to_string(),
            String::from(
                r#"
                    console.log('test's);
                "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        force_runner_type: Some(runner_type),
        context: ExecutionContext {
            ..Default::default()
        },
        ..Default::default()
    });

    let check_result = deno_runner.check(code_files).await.unwrap();
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

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
                import { a } from './potato/a.ts';
                console.log('test');
            "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        force_runner_type: Some(runner_type),
        context: ExecutionContext {
            ..Default::default()
        },
        ..Default::default()
    });

    let check_result = deno_runner.check(code_files).await.unwrap();
    assert!(!check_result.is_empty());
}

#[tokio::test]
async fn check_with_wrong_lib_version() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let code_files = CodeFiles {
        files: HashMap::from([(
            "main.ts".to_string(),
            String::from(
                r#"
                import axios from 'npm:axios@3.4.2';
                console.log('test');
            "#,
            ),
        )]),
        entrypoint: "main.ts".to_string(),
    };

    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        ..Default::default()
    });

    let check_result = deno_runner.check(code_files).await.unwrap();
    assert!(!check_result.is_empty());
    assert!(check_result
        .iter()
        .any(|line| line.contains("Could not find npm package 'axios' matching '3.4.2'")));
}
