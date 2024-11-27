use std::{
    io::Write,
    path::{self, PathBuf},
};

use super::{code_files::CodeFiles, path_buf_ext::PathBufExt};
use super::{execution_context::ExecutionContext, file_name_utils::sanitize_for_file_name};
use nanoid::nanoid;

#[derive(Default, Clone)]
pub struct DenoExecutionStorage {
    pub code_files: CodeFiles,
    pub context: ExecutionContext,
    pub code_id: String,
    pub root_folder_path: PathBuf,
    pub root_code_folder_path: PathBuf,
    pub code_folder_path: PathBuf,
    pub code_entrypoint_file_path: PathBuf,
    pub deno_cache_folder_path: PathBuf,
    pub logs_folder_path: PathBuf,
    pub log_file_path: PathBuf,
    pub home_folder_path: PathBuf,
    pub assets_folder_path: PathBuf,
    pub mount_folder_path: PathBuf,
}

impl DenoExecutionStorage {
    pub fn new(code: CodeFiles, context: ExecutionContext) -> Self {
        let code_id = format!("{}-{}", context.code_id, nanoid!());
        let root_folder_path = path::absolute(
            context
                .storage
                .join(sanitize_for_file_name(context.context_id.clone()))
                .clone(),
        )
        .unwrap();
        let root_code_folder_path = path::absolute(root_folder_path.join("code")).unwrap();
        let code_folder_path = path::absolute(root_code_folder_path.join(code_id.clone())).unwrap();
        let logs_folder_path = path::absolute(root_folder_path.join("logs")).unwrap();
        let log_file_path = path::absolute(logs_folder_path.join(format!(
            "log_{}_{}.log",
            sanitize_for_file_name(context.context_id.clone()),
            sanitize_for_file_name(context.execution_id.clone())
        )))
        .unwrap();
        let deno_cache_folder_path = path::absolute(root_folder_path.join("deno-cache")).unwrap();
        let code_entrypoint_file_path = code_folder_path.join(&code.entrypoint);
        Self {
            code_files: code,
            context,
            code_folder_path,
            code_id: code_id.clone(),
            root_folder_path: root_folder_path.clone(),
            root_code_folder_path,
            code_entrypoint_file_path,
            deno_cache_folder_path,
            logs_folder_path: logs_folder_path.clone(),
            log_file_path,
            home_folder_path: root_folder_path.join("home"),
            assets_folder_path: root_folder_path.join("assets"),
            mount_folder_path: root_folder_path.join("mount"),
        }
    }

    pub fn init(&self, pristine_cache: Option<bool>) -> anyhow::Result<()> {
        for dir in [
            &self.root_folder_path,
            &self.root_code_folder_path,
            &self.code_folder_path,
            &self.deno_cache_folder_path,
            &self.logs_folder_path,
            &self.home_folder_path,
            &self.assets_folder_path,
            &self.mount_folder_path,
        ] {
            log::info!("creating directory: {}", dir.display());
            std::fs::create_dir_all(dir).map_err(|e| {
                log::error!("failed to create directory {}: {}", dir.display(), e);
                e
            })?;
        }

        log::info!(
            "creating project files, entrypoint: {}",
            self.code_files.entrypoint
        );

        for (path, content) in self.code_files.files.iter() {
            let file_path = self.code_folder_path.join(path);
            log::info!("writing file: {}", file_path.display());
            if let Some(parent) = file_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    log::error!(
                        "failed to create parent directory {}: {}",
                        parent.display(),
                        e
                    );
                    e
                })?;
            }
            std::fs::write(&file_path, content).map_err(|e| {
                log::error!("failed to write file {}: {}", file_path.display(), e);
                e
            })?;
        }
        log::info!("creating deno.json file");
        let deno_json_path = self.code_folder_path.join("deno.json");
        std::fs::write(&deno_json_path, "{}").map_err(|e| {
            log::error!("failed to write deno.json file: {}", e);
            e
        })?;

        log::info!(
            "creating log file if not exists: {}",
            self.log_file_path.display()
        );
        if !self.log_file_path.exists() {
            std::fs::write(&self.log_file_path, "").map_err(|e| {
                log::error!("failed to create log file: {}", e);
                e
            })?;
        }

        if pristine_cache.unwrap_or(false) {
            std::fs::remove_dir_all(&self.deno_cache_folder_path)?;
            std::fs::create_dir(&self.deno_cache_folder_path)?;
            log::info!(
                "cleared deno cache directory: {}",
                self.deno_cache_folder_path.display()
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
            .open(self.log_file_path.clone())
            .map_err(|e| {
                log::error!("failed to open log file: {}", e);
                e
            })?;
        file.write_all(log_line.as_bytes())?;
        Ok(())
    }

    pub fn relative_to_root(&self, path: PathBuf) -> String {
        let path = path.strip_prefix(&self.root_folder_path).unwrap();
        path.to_path_buf().as_normalized_string()
    }
}

// TODO: Validate if finally we are going to implement this feature
// We do best effort to remove ephemereal folders
// impl Drop for DenoExecutionStorage {
//     fn drop(&mut self) {
//         if let Err(e) = std::fs::remove_dir_all(&self.code_folder_path) {
//             log::warn!(
//                 "failed to remove code directory {}: {}",
//                 self.code_folder_path.display(),
//                 e
//             );
//         } else {
//             log::info!(
//                 "removed code directory: {}",
//                 self.code_folder_path.display()
//             );
//         }
//     }
// }

#[cfg(test)]
#[path = "deno_execution_storage.test.rs"]
mod tests;
