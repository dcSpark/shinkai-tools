use super::execution_storage::ExecutionStorage;

impl ExecutionStorage {
    pub fn deno_cache_folder_path(&self) -> std::path::PathBuf {
        self.cache_folder_path.join("deno")
    }
    pub fn init_for_deno(&self, pristine_cache: Option<bool>) -> anyhow::Result<()> {
        self.init(pristine_cache)?;

        log::info!("creating deno cache directory");
        let deno_cache_dir = self.deno_cache_folder_path();
        std::fs::create_dir_all(&deno_cache_dir).map_err(|e| {
            log::error!("failed to create deno cache directory: {}", e);
            e
        })?;

        log::info!("creating deno.json file");
        let deno_json_path = self.code_folder_path.join("deno.json");
        std::fs::write(&deno_json_path, "").map_err(|e| {
            log::error!("failed to write deno.json file: {}", e);
            e
        })?;

        Ok(())
    }
}
