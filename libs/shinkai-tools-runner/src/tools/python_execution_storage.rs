use super::execution_storage::ExecutionStorage;

impl ExecutionStorage {
    pub fn python_cache_folder_path(&self) -> std::path::PathBuf {
        self.cache_folder_path.join("python-venv")
    }
    pub fn init_for_python(&self, pristine_cache: Option<bool>) -> anyhow::Result<()> {
        self.init(pristine_cache)?;

        log::info!("creating python cache directory");
        let deno_cache_dir = self.python_cache_folder_path();
        std::fs::create_dir_all(&deno_cache_dir).map_err(|e| {
            log::error!("failed to create deno cache directory: {}", e);
            e
        })?;

        Ok(())
    }
}
