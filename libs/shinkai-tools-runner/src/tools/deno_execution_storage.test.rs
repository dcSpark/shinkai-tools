use std::collections::HashMap;

use crate::tools::{
    code_files::CodeFiles, deno_execution_storage::DenoExecutionStorage,
    execution_context::ExecutionContext,
};

#[tokio::test]
async fn execution_storage_init() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_dir = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");

    let test_code = "console.log('test');";
    let code_files = CodeFiles {
        files: HashMap::from([("main.ts".to_string(), test_code.to_string())]),
        entrypoint: "main.ts".to_string(),
    };

    let storage = DenoExecutionStorage::new(
        code_files,
        ExecutionContext {
            storage: test_dir.clone(),
            ..Default::default()
        },
    );

    storage.init(None).unwrap();

    // Verify directories were created
    assert!(storage.root_folder_path.exists());
    assert!(storage.code_folder_path.exists());
    assert!(storage.deno_cache_folder_path.exists());
    assert!(storage.logs_folder_path.exists());
    assert!(storage.home_folder_path.exists());
    assert!(storage.mount_folder_path.exists());
    assert!(storage.assets_folder_path.exists());
    assert!(storage.code_entrypoint_file_path.exists());
    assert!(storage.code_entrypoint_file_path.file_name().unwrap() == "main.ts");

    // Verify code file was written correctly
    let code_contents = std::fs::read_to_string(storage.code_entrypoint_file_path.clone()).unwrap();
    assert_eq!(code_contents, test_code);
}

#[tokio::test]
async fn execution_storage_clean_cache() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_dir = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");

    // Initialize with some test code
    let test_code = "console.log('test');";

    let storage = DenoExecutionStorage::new(
        CodeFiles {
            files: HashMap::from([("main.ts".to_string(), test_code.to_string())]),
            entrypoint: "main.ts".to_string(),
        },
        ExecutionContext {
            storage: test_dir.clone(),
            ..Default::default()
        },
    );
    storage.init(None).unwrap();

    // Create a test file in the cache directory
    let test_cache_file = storage.deno_cache_folder_path.join("test_cache.txt");
    std::fs::write(&test_cache_file, "test cache content").unwrap();
    assert!(test_cache_file.exists());

    // Reinitialize with pristine cache enabled
    storage.init(Some(true)).unwrap();

    // Verify cache directory was cleared
    assert!(!test_cache_file.exists());
    assert!(storage.deno_cache_folder_path.exists()); // Directory should still exist but be empty
    assert!(
        std::fs::read_dir(&storage.deno_cache_folder_path)
            .unwrap()
            .count()
            == 0
    );
}
