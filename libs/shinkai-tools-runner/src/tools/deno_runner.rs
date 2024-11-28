use tokio::{
    io::{AsyncBufReadExt, BufReader},
    sync::Mutex,
};

use crate::tools::{deno_execution_storage::DenoExecutionStorage, path_buf_ext::PathBufExt};

use super::{
    code_files::CodeFiles,
    container_utils::DockerStatus,
    deno_runner_options::{DenoRunnerOptions, RunnerType},
};
use std::{
    collections::HashMap,
    path::{self, PathBuf},
    sync::Arc,
    time::Duration,
};

#[derive(Default)]
pub struct DenoRunner {
    options: DenoRunnerOptions,
}

impl DenoRunner {
    pub fn new(options: DenoRunnerOptions) -> Self {
        DenoRunner { options }
    }

    /// Checks the code for errors without running it
    ///
    /// # Returns
    ///
    /// Returns a Result containing:
    /// - Ok(Vec<String>): The list of errors found in the code
    /// - Err(anyhow::Error): Any errors that occurred during setup or execution
    pub async fn check(&mut self, code_files: CodeFiles) -> anyhow::Result<Vec<String>> {
        let execution_storage = DenoExecutionStorage::new(code_files, self.options.context.clone());
        execution_storage.init(None)?;

        let binary_path = path::absolute(self.options.deno_binary_path.clone())
            .unwrap()
            .to_string_lossy()
            .to_string();
        let mut command = tokio::process::Command::new(binary_path);
        command
            .args([
                "check",
                execution_storage
                    .code_entrypoint_file_path
                    .to_str()
                    .unwrap(),
            ])
            .current_dir(execution_storage.code_folder_path.clone())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        let output = command.spawn()?.wait_with_output().await?;
        match output.status.success() {
            true => Ok(Vec::new()),
            false => {
                let error_message = String::from_utf8(output.stderr)?;
                let error_lines: Vec<String> =
                    error_message.lines().map(|s| s.to_string()).collect();
                for error in &error_lines {
                    log::error!("deno check error: {}", error);
                }
                Ok(error_lines)
            }
        }
    }

    /// Runs Deno code either in a Docker container or directly on the host system.
    ///
    /// The execution environment is determined automatically based on whether Docker is available.
    /// If Docker is detected, the code runs in an isolated container using the configured Deno image.
    /// Otherwise, it falls back to running directly on the host using a local Deno binary.
    ///
    /// # Arguments
    ///
    /// * `code` - The Deno/TypeScript code to execute as a string
    /// * `envs` - Optional HashMap of environment variables to pass to the execution environment
    /// * `max_execution_time_s` - Optional timeout in seconds after which execution will be terminated
    ///
    /// # Returns
    ///
    /// Returns a Result containing:
    /// - Ok(String): The combined stdout/stderr output from the code execution
    /// - Err(anyhow::Error): Any errors that occurred during setup or execution
    ///
    /// # Example
    ///
    /// ```no_run
    /// let mut runner = DenoRunner::new(DenoRunnerOptions::default());
    /// let result = runner.run(
    ///     "console.log('Hello from Deno!')",
    ///     None,
    ///     Some(30)
    /// ).await?;
    /// ```
    pub async fn run(
        &mut self,
        code_files: CodeFiles,
        envs: Option<HashMap<String, String>>,
        max_execution_timeout: Option<Duration>,
    ) -> anyhow::Result<Vec<String>> {
        match self.options.force_runner_type {
            Some(RunnerType::Host) => {
                self.run_in_host(code_files, envs, max_execution_timeout)
                    .await
            }
            Some(RunnerType::Docker) => {
                self.run_in_docker(code_files, envs, max_execution_timeout)
                    .await
            }
            _ => {
                if super::container_utils::is_docker_available() == DockerStatus::Running {
                    self.run_in_docker(code_files, envs, max_execution_timeout)
                        .await
                } else {
                    self.run_in_host(code_files, envs, max_execution_timeout)
                        .await
                }
            }
        }
    }

    async fn run_in_docker(
        &mut self,
        code_files: CodeFiles,
        envs: Option<HashMap<String, String>>,
        max_execution_timeout: Option<Duration>,
    ) -> anyhow::Result<Vec<String>> {
        log::info!(
            "using deno from container image:{:?}",
            self.options.deno_image_name
        );

        let execution_storage = DenoExecutionStorage::new(code_files, self.options.context.clone());
        execution_storage.init(None)?;

        let mut mount_params = Vec::<String>::new();

        let mount_dirs = [
            (
                execution_storage.code_folder_path.as_normalized_string(),
                execution_storage.relative_to_root(execution_storage.code_folder_path.clone()),
            ),
            (
                execution_storage
                    .deno_cache_folder_path
                    .as_normalized_string(),
                execution_storage
                    .relative_to_root(execution_storage.deno_cache_folder_path.clone()),
            ),
            (
                execution_storage.home_folder_path.as_normalized_string(),
                execution_storage.relative_to_root(execution_storage.home_folder_path.clone()),
            ),
        ];
        for (dir, relative_path) in mount_dirs {
            let mount_param = format!(r#"type=bind,source={},target=/app/{}"#, dir, relative_path);
            log::info!("mount parameter created: {}", mount_param);
            mount_params.extend([String::from("--mount"), mount_param]);
        }

        let mut mount_env = String::from("");
        log::info!("mount files: {:?}", self.options.context.mount_files);
        // Mount each writable file to /app/mount
        for file in &self.options.context.mount_files {
            let target_path = format!(
                "/app/{}/{}",
                execution_storage.relative_to_root(execution_storage.mount_folder_path.clone()),
                file.file_name().unwrap().to_str().unwrap()
            );

            // TODO: This hardcoded app could be buggy if later we make some changes to the execution storage
            let mount_param = format!(
                r#"type=bind,source={},target={}"#,
                path::absolute(file).unwrap().as_normalized_string(),
                target_path.clone()
            );
            log::info!("mount parameter created: {}", mount_param);
            mount_env += &format!("{},", target_path);
            mount_params.extend([String::from("--mount"), mount_param]);
        }

        let mut mount_assets_env = String::from("");
        // Mount each asset file to /app/assets
        for file in &self.options.context.assets_files {
            let target_path = format!(
                "/app/{}/{}",
                execution_storage.relative_to_root(execution_storage.assets_folder_path.clone()),
                file.file_name().unwrap().to_str().unwrap()
            );
            let mount_param = format!(
                r#"type=bind,readonly=true,source={},target={}"#,
                path::absolute(file).unwrap().as_normalized_string(),
                target_path,
            );
            log::debug!("mount parameter created: {}", mount_param);
            mount_assets_env += &format!("{},", target_path);
            mount_params.extend([String::from("--mount"), mount_param]);
        }

        let mut container_envs = Vec::<String>::new();

        container_envs.push(String::from("-e"));
        container_envs.push(format!(
            "DENO_DIR={}",
            execution_storage.relative_to_root(execution_storage.deno_cache_folder_path.clone())
        ));

        container_envs.push(String::from("-e"));
        container_envs.push(format!(
            "SHINKAI_NODE_LOCATION={}://host.docker.internal:{}",
            self.options.shinkai_node_location.protocol, self.options.shinkai_node_location.port
        ));

        container_envs.push(String::from("-e"));
        container_envs.push(String::from("HOME=/app/home"));
        container_envs.push(String::from("-e"));
        container_envs.push(format!("ASSETS={}", mount_assets_env));
        container_envs.push(String::from("-e"));
        container_envs.push(format!("MOUNT={}", mount_env));
        container_envs.push(String::from("-e"));
        container_envs.push(format!("CONTEXT_ID={}", self.options.context.context_id));
        container_envs.push(String::from("-e"));
        container_envs.push(format!("EXECUTION_ID={}", self.options.context.execution_id));

        if let Some(envs) = envs {
            for (key, value) in envs {
                let env = format!("{}={}", key, value);
                container_envs.push(String::from("-e"));
                container_envs.push(env);
            }
        }

        let deno_permissions = self.get_deno_permissions(
            "/usr/bin/deno",
            "/app/home",
            &self
                .options
                .context
                .mount_files
                .iter()
                .map(|p| {
                    let path_in_docker = format!(
                        "/app/{}/{}",
                        execution_storage
                            .relative_to_root(execution_storage.mount_folder_path.clone()),
                        p.file_name().unwrap().to_str().unwrap()
                    );
                    PathBuf::from(path_in_docker)
                })
                .collect::<Vec<_>>(),
            &self
                .options
                .context
                .assets_files
                .iter()
                .map(|p| {
                    let path_in_docker = format!(
                        "/app/{}/{}",
                        execution_storage
                            .relative_to_root(execution_storage.assets_folder_path.clone()),
                        p.file_name().unwrap().to_str().unwrap()
                    );
                    PathBuf::from(path_in_docker)
                })
                .collect::<Vec<_>>(),
        );

        let code_entrypoint =
            execution_storage.relative_to_root(execution_storage.code_entrypoint_file_path.clone());
        let mut command = tokio::process::Command::new("docker");
        let mut args = vec!["run", "--rm"];
        args.extend(mount_params.iter().map(|s| s.as_str()));
        args.extend(container_envs.iter().map(|s| s.as_str()));
        args.extend([
            "--workdir",
            "/app",
            self.options.deno_image_name.as_str(),
            "run",
            "--ext",
            "ts",
        ]);
        args.extend(deno_permissions.iter().map(|s| s.as_str()));
        args.extend([code_entrypoint.as_str()]);
        let command = command
            .args(args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        log::info!("spawning docker command");
        let mut child = command.spawn().map_err(|e| {
            log::error!("failed to spawn command: {}", e);
            e
        })?;

        let stdout = child.stdout.take().expect("Failed to get stdout");
        let mut stdout_stream = BufReader::new(stdout).lines();

        let stderr = child.stderr.take().expect("Failed to get stderr");
        let mut stderr_stream = BufReader::new(stderr).lines();

        let stdout_lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let stderr_lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let execution_storage_clone = execution_storage.clone();

        let stdout_lines_clone = stdout_lines.clone();
        let stderr_lines_clone = stderr_lines.clone();
        let execution_storage_clone2 = execution_storage_clone.clone();

        let stdout_task = tokio::task::spawn_blocking(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                while let Ok(Some(line)) = stdout_stream.next_line().await {
                    log::info!("from deno: {}", line);
                    stdout_lines_clone.lock().await.push(line.clone());
                    let _ = execution_storage_clone.append_log(line.as_str());
                }
            });
        });

        let stderr_task = tokio::task::spawn_blocking(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                while let Ok(Some(line)) = stderr_stream.next_line().await {
                    log::info!("from deno: {}", line);
                    stderr_lines_clone.lock().await.push(line.clone());
                    let _ = execution_storage_clone2.append_log(line.as_str());
                }
            });
        });

        #[allow(clippy::let_underscore_future)]
        let std_tasks = tokio::spawn(async move {
            let _ = futures::future::join_all(vec![stdout_task, stderr_task]).await;
        });

        let output = if let Some(timeout) = max_execution_timeout {
            log::info!("executing command with {}[s] timeout", timeout.as_secs());
            match tokio::time::timeout(timeout, child.wait_with_output()).await {
                Ok(result) => result?,
                Err(_) => {
                    log::error!("command execution timed out after {}[s]", timeout.as_secs());
                    return Err(anyhow::anyhow!(
                        "process timed out after {}[s]",
                        timeout.as_secs()
                    ));
                }
            }
        } else {
            log::info!("executing command without timeout");
            child.wait_with_output().await?
        };
        let _ = std_tasks.await;
        if !output.status.success() {
            let stderr = stderr_lines.lock().await.to_vec().join("\n");
            log::error!("command execution failed: {}", stderr);
            return Err(anyhow::Error::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                stderr.to_string(),
            )));
        }

        let stdout: Vec<String> = stdout_lines.lock().await.to_vec();
        log::info!("command completed successfully with output: {:?}", stdout);
        Ok(stdout)
    }

    async fn run_in_host(
        &mut self,
        code_files: CodeFiles,
        envs: Option<HashMap<String, String>>,
        max_execution_timeout: Option<Duration>,
    ) -> anyhow::Result<Vec<String>> {
        let execution_storage = DenoExecutionStorage::new(code_files, self.options.context.clone());
        execution_storage.init(None)?;

        let binary_path = path::absolute(self.options.deno_binary_path.clone())
            .unwrap()
            .to_string_lossy()
            .to_string();
        log::info!("using deno from host at path: {:?}", binary_path.clone());

        let deno_permissions: Vec<String> = self.get_deno_permissions(
            binary_path.clone().as_str(),
            execution_storage
                .home_folder_path
                .to_string_lossy()
                .to_string()
                .as_str(),
            &self
                .options
                .context
                .mount_files
                .iter()
                .map(|p| path::absolute(p).unwrap())
                .collect::<Vec<_>>(),
            &self
                .options
                .context
                .assets_files
                .iter()
                .map(|p| path::absolute(p).unwrap())
                .collect::<Vec<_>>(),
        );

        let mut command = tokio::process::Command::new(binary_path);
        let command = command
            .args(["run", "--ext", "ts"])
            .args(deno_permissions)
            .arg(execution_storage.code_entrypoint_file_path.clone())
            .current_dir(execution_storage.root_folder_path.clone())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        command.env("DENO_DIR", execution_storage.deno_cache_folder_path.clone());
        command.env(
            "SHINKAI_NODE_LOCATION",
            format!(
                "{}://{}:{}",
                self.options.shinkai_node_location.protocol,
                self.options.shinkai_node_location.host,
                self.options.shinkai_node_location.port
            ),
        );

        command.env("HOME", execution_storage.home_folder_path.clone());
        command.env(
            "ASSETS",
            self.options
                .context
                .assets_files
                .iter()
                .map(|p| path::absolute(p).unwrap().to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(","),
        );
        command.env(
            "MOUNT",
            self.options
                .context
                .mount_files
                .iter()
                .map(|p| path::absolute(p).unwrap().to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(","),
        );

        command.env("CONTEXT_ID", self.options.context.context_id.clone());
        command.env("EXECUTION_ID", self.options.context.execution_id.clone());

        if let Some(envs) = envs {
            command.envs(envs);
        }
        log::info!("prepared command with arguments: {:?}", command);
        let mut child = command.spawn().map_err(|e| {
            log::error!("failed to spawn command: {}", e);
            e
        })?;

        let stdout = child.stdout.take().expect("Failed to get stdout");
        let mut stdout_stream = BufReader::new(stdout).lines();

        let stderr = child.stderr.take().expect("Failed to get stderr");
        let mut stderr_stream = BufReader::new(stderr).lines();

        let stdout_lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let stderr_lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let execution_storage_clone = execution_storage.clone();

        let stdout_lines_clone = stdout_lines.clone();
        let stderr_lines_clone = stderr_lines.clone();
        let execution_storage_clone2 = execution_storage_clone.clone();

        let stdout_task = tokio::task::spawn_blocking(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                while let Ok(Some(line)) = stdout_stream.next_line().await {
                    log::info!("from deno: {}", line);
                    stdout_lines_clone.lock().await.push(line.clone());
                    let _ = execution_storage_clone.append_log(line.as_str());
                }
            });
        });

        let stderr_task = tokio::task::spawn_blocking(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                while let Ok(Some(line)) = stderr_stream.next_line().await {
                    log::info!("from deno: {}", line);
                    stderr_lines_clone.lock().await.push(line.clone());
                    let _ = execution_storage_clone2.append_log(line.as_str());
                }
            });
        });

        #[allow(clippy::let_underscore_future)]
        let std_tasks = tokio::spawn(async move {
            let _ = futures::future::join_all(vec![stdout_task, stderr_task]).await;
        });

        let output = if let Some(timeout) = max_execution_timeout {
            log::info!("executing command with {}[s] timeout", timeout.as_secs());
            match tokio::time::timeout(timeout, child.wait_with_output()).await {
                Ok(result) => result?,
                Err(_) => {
                    log::error!("command execution timed out after {}[s]", timeout.as_secs());
                    return Err(anyhow::Error::new(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        format!("process timed out after {}[s]", timeout.as_secs()),
                    )));
                }
            }
        } else {
            log::info!("executing command without timeout");
            child.wait_with_output().await?
        };
        let _ = std_tasks.await;
        if !output.status.success() {
            let stderr = stderr_lines.lock().await.to_vec().join("\n");
            log::error!("command execution failed: {}", stderr);
            return Err(anyhow::Error::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                stderr.to_string(),
            )));
        }
        let stdout: Vec<String> = stdout_lines.lock().await.to_vec();
        log::info!("command completed successfully with output: {:?}", stdout);
        Ok(stdout)
    }

    fn get_deno_permissions(
        &self,
        exec_path: &str,
        home_path: &str,
        mount_files: &[PathBuf],
        assets_files: &[PathBuf],
    ) -> Vec<String> {
        log::info!("mount files: {:?}", mount_files);
        log::info!("assets files: {:?}", assets_files);
        let mut deno_permissions: Vec<String> = vec![
            // Basically all non-file related permissions
            "--allow-env".to_string(),
            "--allow-run".to_string(),
            "--allow-net".to_string(),
            "--allow-sys".to_string(),
            "--allow-scripts".to_string(),
            "--allow-ffi".to_string(),
            "--allow-import".to_string(),

            // Engine folders
            "--allow-read=.".to_string(),
            format!("--allow-write={}", home_path.to_string()),

            // Playwright/Chrome folders
            format!("--allow-read={}", exec_path.to_string()),
            "--allow-write=/var/folders".to_string(),
            "--allow-read=/var/folders".to_string(),
            "--allow-read=/tmp".to_string(),
            "--allow-write=/tmp".to_string(),
            format!("--allow-read={}", std::env::temp_dir().to_string_lossy()),
            format!("--allow-write={}", std::env::temp_dir().to_string_lossy()),
            "--allow-read=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".to_string(),
            "--allow-read=/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary".to_string(),
            "--allow-read=/Applications/Chromium.app/Contents/MacOS/Chromium".to_string(),
            "--allow-read=C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe".to_string(),
            "--allow-read=C:\\Program Files (x86)\\Google\\Chrome SxS\\Application\\chrome.exe".to_string(),
            "--allow-read=C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe".to_string(),
            "--allow-read=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe".to_string(),
            "--allow-read=C:\\Program Files\\Google\\Chrome SxS\\Application\\chrome.exe".to_string(),
            "--allow-read=C:\\Program Files\\Chromium\\Application\\chrome.exe".to_string(),
            "--allow-read=/usr/bin/chromium".to_string(),
        ];

        for file in mount_files {
            let mount_param = format!(
                r#"--allow-read={},--allow-write={}"#,
                file.to_string_lossy(),
                file.to_string_lossy()
            );
            deno_permissions.extend(mount_param.split(',').map(String::from));
        }

        for file in assets_files {
            let asset_param = format!(r#"--allow-read={}"#, file.to_string_lossy());
            deno_permissions.push(asset_param);
        }
        log::info!("deno permissions: {}", deno_permissions.join(" "));
        deno_permissions
    }
}

#[cfg(test)]
#[path = "deno_runner.test.rs"]
mod tests;
