use std::{
    io::Write,
    path::{self, PathBuf},
};

use super::execution_context::ExecutionContext;
use super::path_buf_ext::PathBufExt;
use nanoid::nanoid;

#[derive(Default, Clone)]
pub struct DenoExecutionStorage {
    pub context: ExecutionContext,
    pub code_id: String,
    pub root: PathBuf,
    pub root_code: PathBuf,
    pub code: PathBuf,
    pub code_entrypoint: PathBuf,
    pub deno_cache: PathBuf,
    pub logs: PathBuf,
    pub log_file: PathBuf,
    pub home: PathBuf,
    pub assets: PathBuf,
    pub mount: PathBuf,
}

impl DenoExecutionStorage {
    pub fn new(context: ExecutionContext) -> Self {
        let code_id = format!("{}-{}", context.code_id, nanoid!());
        let root =
            path::absolute(context.storage.join(context.context_id.clone()).clone()).unwrap();
        let root_code = path::absolute(root.join("code")).unwrap();
        let code = path::absolute(root_code.join(code_id.clone())).unwrap();
        let logs = path::absolute(root.join("logs")).unwrap();
        let log_file = path::absolute(logs.join(format!(
            "log_{}_{}.log",
            context.context_id, context.execution_id,
        )))
        .unwrap();
        let deno_cache = path::absolute(root.join("deno-cache")).unwrap();
        Self {
            context,
            code_id: code_id.clone(),
            root: root.clone(),
            root_code,
            code: code.clone(),
            code_entrypoint: code.join("index.ts"),
            deno_cache,
            logs: logs.clone(),
            log_file,
            home: root.join("home"),
            assets: root.join("assets"),
            mount: root.join("mount"),
        }
    }

    pub fn init(&self, code: &str, pristine_cache: Option<bool>) -> anyhow::Result<()> {
        for dir in [
            &self.root,
            &self.root_code,
            &self.code,
            &self.deno_cache,
            &self.logs,
            &self.home,
            &self.assets,
            &self.mount,
        ] {
            log::info!("creating directory: {}", dir.display());
            std::fs::create_dir_all(dir).map_err(|e| {
                log::error!("failed to create directory {}: {}", dir.display(), e);
                e
            })?;
        }

        log::info!("creating code file: {}", self.code_entrypoint.display());
        std::fs::write(&self.code_entrypoint, code).map_err(|e| {
            log::error!("failed to write code to index.ts: {}", e);
            e
        })?;

        log::info!(
            "creating log file if not exists: {}",
            self.log_file.display()
        );
        if !self.log_file.exists() {
            std::fs::write(&self.log_file, "").map_err(|e| {
                log::error!("failed to create log file: {}", e);
                e
            })?;
        }

        if pristine_cache.unwrap_or(false) {
            std::fs::remove_dir_all(&self.deno_cache)?;
            std::fs::create_dir(&self.deno_cache)?;
            log::info!(
                "cleared deno cache directory: {}",
                self.deno_cache.display()
            );
        }

        Ok(())
    }

    pub fn append_log(&self, log: &str) -> anyhow::Result<()> {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let log_line = format!(
            "{},{},{},{},{}\n",
            timestamp, self.context.context_id, self.context.execution_id, self.code_id, log,
        );
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .create(true) // Create the file if it doesn't exist
            .open(self.log_file.clone())
            .map_err(|e| {
                log::error!("failed to open log file: {}", e);
                e
            })?;
        file.write_all(log_line.as_bytes())?;
        Ok(())
    }

    pub fn relative_to_root(&self, path: PathBuf) -> String {
        let path = path.strip_prefix(&self.root).unwrap();
        path.to_path_buf().as_normalized_string()
    }
}

// We do best effort to remove ephemereal folders
impl Drop for DenoExecutionStorage {
    fn drop(&mut self) {
        if let Err(e) = std::fs::remove_dir_all(&self.code) {
            log::warn!(
                "failed to remove code directory {}: {}",
                self.code.display(),
                e
            );
        } else {
            log::info!("removed code directory: {}", self.code.display());
        }
    }
}

#[cfg(test)]
#[path = "deno_execution_storage.test.rs"]
mod tests;
