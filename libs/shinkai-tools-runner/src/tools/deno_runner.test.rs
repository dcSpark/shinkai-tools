use crate::tools::{
    code_files::CodeFiles,
    deno_execution_storage::DenoExecutionStorage,
    deno_runner::DenoRunner,
    deno_runner_options::{DenoRunnerOptions, RunnerType, ShinkaiNodeLocation},
    execution_context::ExecutionContext,
};
use std::collections::HashMap;

#[tokio::test]
async fn test_run_echo_tool() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let mut deno_runner = DenoRunner::default();
    let code = r#"
      console.log('{"message":"hello world"}');
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
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

#[tokio::test]
async fn test_run_with_env() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let mut deno_runner = DenoRunner::default();
    let code = r#"
      console.log(process.env.HELLO_WORLD);
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };
    let mut envs = HashMap::<String, String>::new();
    envs.insert("HELLO_WORLD".to_string(), "hello world!".to_string()); // Insert the key-value pair
    let result = deno_runner.run(code_files, Some(envs), None).await.unwrap();

    assert_eq!(result.first().unwrap(), "hello world!");
}

#[tokio::test]
async fn test_write_forbidden_folder() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        force_runner_type: Some(RunnerType::Host),
        ..Default::default()
    });

    let code = r#"
      try {
        await Deno.writeTextFile("/test.txt", "This should fail");
        console.log('write succeeded');
      } catch (e) {
        // We expect this to fail due to permissions
        console.log('error', e);
        throw e;
      }
    "#;

    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let result = deno_runner.run(code_files, None, None).await.map_err(|e| {
        log::error!("Failed to run deno code: {}", e);
        e
    });
    assert!(result.is_err());
}

#[tokio::test]
async fn test_execution_storage_cache_contains_files() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_dir = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");

    let test_code = r#"
        import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
        console.log('test');
    "#;
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), test_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };
    let context_id = String::from("test-execution-cache");
    // Run the code to ensure dependencies are downloaded
    let mut deno_runner = DenoRunner::new(DenoRunnerOptions {
        context: ExecutionContext {
            storage: test_dir.clone(),
            context_id: context_id.clone(),
            ..Default::default()
        },
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
            storage: test_dir.clone(),
            context_id,
            ..Default::default()
        },
    );

    assert!(storage.deno_cache_folder_path.exists());
    let cache_files = std::fs::read_dir(&storage.deno_cache_folder_path).unwrap();
    assert!(cache_files.count() > 0);
}

#[tokio::test]
async fn test_run_with_shinkai_node_location_host() {
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
        force_runner_type: Some(RunnerType::Host),
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
    assert_eq!(result.first().unwrap(), "https://127.0.0.2:9554");
}

#[tokio::test]
async fn test_run_with_shinkai_node_location_docker() {
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
        force_runner_type: Some(RunnerType::Docker),
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
    assert_eq!(result.first().unwrap(), "https://host.docker.internal:9554");
}

#[tokio::test]
async fn test_run_with_file_sub_path() {
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
        force_runner_type: Some(RunnerType::Docker),
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

#[tokio::test]
async fn test_run_with_imports() {
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
        force_runner_type: Some(RunnerType::Docker),
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
