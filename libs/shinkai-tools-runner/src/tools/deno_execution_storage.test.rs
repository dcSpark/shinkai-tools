use crate::tools::{
    deno_execution_storage::DenoExecutionStorage, execution_context::ExecutionContext,
};

#[tokio::test]
async fn test_execution_storage_init() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_dir = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");
    let storage = DenoExecutionStorage::new(ExecutionContext {
        storage: test_dir.clone(),
        ..Default::default()
    });

    let test_code = "console.log('test');";
    storage.init(test_code, None).unwrap();

    // Verify directories were created
    assert!(storage.root.exists());
    assert!(storage.code.exists());
    assert!(storage.deno_cache.exists());
    assert!(storage.logs.exists());
    assert!(storage.home.exists());

    // Verify code file was written correctly
    let code_contents = std::fs::read_to_string(storage.code_entrypoint.clone()).unwrap();
    assert_eq!(code_contents, test_code);
}

#[tokio::test]
async fn test_execution_storage_clean_cache() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();

    let test_dir = std::path::PathBuf::from("./shinkai-tools-runner-execution-storage");
    let storage = DenoExecutionStorage::new(ExecutionContext {
        storage: test_dir.clone(),
        ..Default::default()
    });

    // Initialize with some test code
    let test_code = "console.log('test');";
    storage.init(test_code, None).unwrap();

    // Create a test file in the cache directory
    let test_cache_file = storage.deno_cache.join("test_cache.txt");
    std::fs::write(&test_cache_file, "test cache content").unwrap();
    assert!(test_cache_file.exists());

    // Reinitialize with pristine cache enabled
    storage.init(test_code, Some(true)).unwrap();

    // Verify cache directory was cleared
    assert!(!test_cache_file.exists());
    assert!(storage.deno_cache.exists()); // Directory should still exist but be empty
    assert!(std::fs::read_dir(&storage.deno_cache).unwrap().count() == 0);
}
