use serde_json::Value;
use std::{
    collections::HashMap,
    path::{self, Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    sync::Mutex,
};

use crate::tools::{
    execution_error::ExecutionError, path_buf_ext::PathBufExt, run_result::RunResult,
};

use super::{
    code_files::CodeFiles, container_utils::DockerStatus, execution_storage::ExecutionStorage,
    python_runner_options::PythonRunnerOptions, runner_type::RunnerType,
};

pub struct PythonRunner {
    code: CodeFiles,
    configurations: Value,
    options: PythonRunnerOptions,
}

impl PythonRunner {
    pub const MAX_EXECUTION_TIME_MS_INTERNAL_OPS: u64 = 1000;

    pub fn new(
        code_files: CodeFiles,
        configurations: Value,
        options: Option<PythonRunnerOptions>,
    ) -> Self {
        let options = options.unwrap_or_default();
        PythonRunner {
            code: code_files,
            configurations,
            options,
        }
    }

    async fn ensure_python_venv(&self, venv_path: PathBuf) -> anyhow::Result<String> {
        let uv_binary_path_at_host = path::absolute(self.options.uv_binary_path.clone())
            .unwrap()
            .to_string_lossy()
            .to_string();

        log::info!("Creating new venv with uv {:?}", venv_path);
        let mut venv_command = tokio::process::Command::new(&uv_binary_path_at_host);
        venv_command
            .args([
                "venv",
                "--seed",
                venv_path.to_str().unwrap(),
                "--python",
                "3.13",
            ])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        let venv_output = venv_command.spawn()?.wait_with_output().await?;
        if !venv_output.status.success() {
            return Err(anyhow::Error::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                String::from_utf8(venv_output.stderr)?,
            )));
        }

        log::info!("successfully created Python venv at {:?}", venv_path);

        let python_path_at_venv = venv_path
            .join(if cfg!(windows) { "Scripts" } else { "bin" })
            .join(if cfg!(windows) {
                "python.exe"
            } else {
                "python"
            });

        let python_binary_path = python_path_at_venv.to_string_lossy().to_string();
        log::info!("python binary path: {}", python_binary_path);
        Ok(python_binary_path)
    }

    pub async fn check(&self) -> anyhow::Result<Vec<String>> {
        let execution_storage =
            ExecutionStorage::new(self.code.clone(), self.options.context.clone());
        execution_storage.init_for_python(None)?;

        let python_binary_path: String = self
            .ensure_python_venv(execution_storage.python_cache_folder_path())
            .await?;

        log::info!(
            "using python from host at path: {:?}",
            python_binary_path.clone()
        );

        let mut command = tokio::process::Command::new(python_binary_path);
        println!(
            "compiling code in folder: {}",
            execution_storage.code_folder_path.to_str().unwrap()
        );
        command
            .args([
                "-m",
                "py_compile",
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
                    log::error!("python check error: {}", error);
                }
                Ok(error_lines)
            }
        }
    }

    pub async fn run(
        &self,
        envs: Option<HashMap<String, String>>,
        parameters: Value,
        max_execution_timeout: Option<Duration>,
    ) -> Result<RunResult, ExecutionError> {
        log::info!("preparing to run tool");
        log::info!("configurations: {}", self.configurations.to_string());
        log::info!("parameters: {}", parameters.to_string());

        let mut code = self.code.clone();
        let entrypoint_code = code.files.get(&self.code.entrypoint.clone());
        if let Some(entrypoint_code) = entrypoint_code {
            let adapted_entrypoint_code = format!(
                r#"
{}
import json
import asyncio
configurations = json.loads('{}')
parameters = json.loads('{}')

result = run(configurations, parameters)
if asyncio.iscoroutine(result):
    result = asyncio.run(result)
if hasattr(result, '__dict__'):
    print("Using __dict__ to serialize object")
    print(result)
    print(result.__dict__)
    serialiable_result = result.__dict__
else:
    serialiable_result = result
print("<shinkai-code-result>")
print(json.dumps(serialiable_result))
print("</shinkai-code-result>")
        "#,
                &entrypoint_code,
                serde_json::to_string(&self.configurations)
                    .unwrap()
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\"", "\\\""),
                serde_json::to_string(&parameters)
                    .unwrap()
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\"", "\\\"")
            );
            code.files
                .insert(self.code.entrypoint.clone(), adapted_entrypoint_code);
        }

        let result = match self.options.force_runner_type {
            Some(RunnerType::Host) => self.run_in_host(code, envs, max_execution_timeout).await,
            Some(RunnerType::Docker) => self.run_in_docker(code, envs, max_execution_timeout).await,
            _ => {
                if super::container_utils::is_docker_available() == DockerStatus::Running {
                    self.run_in_docker(code, envs, max_execution_timeout).await
                } else {
                    self.run_in_host(code, envs, max_execution_timeout).await
                }
            }
        }
        .map_err(|e| ExecutionError::new(e.to_string(), None))?;

        let result_text = result
            .iter()
            .skip_while(|line| !line.contains("<shinkai-code-result>"))
            .skip(1)
            .take_while(|line| !line.contains("</shinkai-code-result>"))
            .map(|s| s.to_string())
            .collect::<Vec<String>>()
            .join("\n");

        log::info!("result : {:?}", result);
        log::info!("result text: {:?}", result_text);

        let result: Value = serde_json::from_str(&result_text).map_err(|e| {
            log::info!("failed to parse result: {}", e);
            ExecutionError::new(format!("failed to parse result: {}", e), None)
        })?;
        log::info!("successfully parsed run result: {:?}", result);
        Ok(RunResult { data: result })
    }

    async fn run_in_docker(
        &self,
        code_files: CodeFiles,
        envs: Option<HashMap<String, String>>,
        max_execution_timeout: Option<Duration>,
    ) -> anyhow::Result<Vec<String>> {
        log::info!(
            "using python from container image:{:?}",
            self.options.code_runner_docker_image_name
        );

        log::info!("code files: {:?}", code_files.files.get("main.py"));
        let execution_storage = ExecutionStorage::new(code_files, self.options.context.clone());
        execution_storage.init_for_python(None)?;

        let mut mount_params = Vec::<String>::new();

        let mount_dirs = [
            (
                execution_storage.code_folder_path.as_normalized_string(),
                execution_storage.relative_to_root(execution_storage.code_folder_path.clone()),
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
            "SHINKAI_NODE_LOCATION={}://host.docker.internal:{}",
            self.options.shinkai_node_location.protocol, self.options.shinkai_node_location.port
        ));

        container_envs.push(String::from("-e"));
        container_envs.push(String::from("SHINKAI_HOME=/app/home"));
        container_envs.push(String::from("-e"));
        container_envs.push(format!("SHINKAI_ASSETS={}", mount_assets_env));
        container_envs.push(String::from("-e"));
        container_envs.push(format!("SHINKAI_MOUNT={}", mount_env));
        container_envs.push(String::from("-e"));
        container_envs.push(format!(
            "SHINKAI_CONTEXT_ID={}",
            self.options.context.context_id
        ));
        container_envs.push(String::from("-e"));
        container_envs.push(format!(
            "SHINKAI_EXECUTION_ID={}",
            self.options.context.execution_id
        ));

        if let Some(envs) = envs {
            for (key, value) in envs {
                let env = format!("{}={}", key, value);
                container_envs.push(String::from("-e"));
                container_envs.push(env);
            }
        }

        let code_entrypoint =
            execution_storage.relative_to_root(execution_storage.code_entrypoint_file_path.clone());
        let mut command = tokio::process::Command::new("docker");
        let mut args = vec!["run", "--rm"];
        args.extend(mount_params.iter().map(|s| s.as_str()));
        args.extend(container_envs.iter().map(|s| s.as_str()));

        let code_folder = Path::new(code_entrypoint.as_str())
            .parent()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let python_start_script = format!(
            "source /app/cache/python-venv/bin/activate && python -m pipreqs.pipreqs --encoding utf-8 --force {} && uv pip install -r {}/requirements.txt && python {}",
            code_folder.clone().as_str(),
            code_folder.clone().as_str(),
            code_entrypoint.clone().as_str(),
        );

        args.extend([
            "--workdir",
            "/app",
            self.options.code_runner_docker_image_name.as_str(),
            "/bin/bash",
            "-c",
            python_start_script.as_str(),
        ]);
        // args.extend([code_entrypoint.as_str()]);
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
                    log::info!("from python: {}", line);
                    stdout_lines_clone.lock().await.push(line.clone());
                    let _ = execution_storage_clone.append_log(line.as_str());
                }
            });
        });

        let stderr_task = tokio::task::spawn_blocking(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                while let Ok(Some(line)) = stderr_stream.next_line().await {
                    log::info!("from python: {}", line);
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
        &self,
        code_files: CodeFiles,
        envs: Option<HashMap<String, String>>,
        max_execution_timeout: Option<Duration>,
    ) -> anyhow::Result<Vec<String>> {
        let execution_storage = ExecutionStorage::new(code_files, self.options.context.clone());
        execution_storage.init_for_python(None)?;

        let python_binary_path: String = self
            .ensure_python_venv(execution_storage.python_cache_folder_path())
            .await?;

        log::info!(
            "using python from host at path: {:?}",
            python_binary_path.clone()
        );

        let uv_binary_path = path::absolute(self.options.uv_binary_path.clone())
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        let mut ensure_pip_command = tokio::process::Command::new(&uv_binary_path);
        ensure_pip_command
            .args(["pip", "install", "pipreqs"])
            .env(
                "VIRTUAL_ENV",
                execution_storage
                    .python_cache_folder_path()
                    .to_str()
                    .unwrap(),
            )
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        let pip_output = ensure_pip_command.spawn()?.wait_with_output().await?;
        if !pip_output.status.success() {
            return Err(anyhow::Error::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                String::from_utf8(pip_output.stderr)?,
            )));
        }

        let mut pipreqs_command = tokio::process::Command::new(&python_binary_path);
        pipreqs_command
            .args([
                "-m",
                "pipreqs.pipreqs",
                "--encoding",
                "utf-8",
                "--force",
                execution_storage.code_folder_path.to_str().unwrap(),
            ])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        let pipreqs_output = pipreqs_command.spawn()?.wait_with_output().await?;
        if !pipreqs_output.status.success() {
            return Err(anyhow::Error::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                String::from_utf8(pipreqs_output.stderr)?,
            )));
        }

        let mut pip_install_command = tokio::process::Command::new(&uv_binary_path);
        pip_install_command
            .args(["pip", "install", "-r", "requirements.txt"])
            .env(
                "VIRTUAL_ENV",
                execution_storage
                    .python_cache_folder_path()
                    .to_str()
                    .unwrap(),
            )
            .current_dir(execution_storage.code_folder_path.clone())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        let pip_install_output = pip_install_command.spawn()?.wait_with_output().await?;
        if !pip_install_output.status.success() {
            return Err(anyhow::Error::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                String::from_utf8(pip_install_output.stderr)?,
            )));
        }

        let mut command = tokio::process::Command::new(python_binary_path);
        let command = command
            .arg(execution_storage.code_entrypoint_file_path.clone())
            .current_dir(execution_storage.root_folder_path.clone())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        command.env(
            "SHINKAI_NODE_LOCATION",
            format!(
                "{}://{}:{}",
                self.options.shinkai_node_location.protocol,
                self.options.shinkai_node_location.host,
                self.options.shinkai_node_location.port
            ),
        );

        command.env("SHINKAI_HOME", execution_storage.home_folder_path.clone());
        command.env(
            "SHINKAI_ASSETS",
            self.options
                .context
                .assets_files
                .iter()
                .map(|p| path::absolute(p).unwrap().to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(","),
        );
        command.env(
            "SHINKAI_MOUNT",
            self.options
                .context
                .mount_files
                .iter()
                .map(|p| path::absolute(p).unwrap().to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(","),
        );
        command.env(
            "SHINKAI_CONTEXT_ID",
            self.options.context.context_id.clone(),
        );
        command.env(
            "SHINKAI_EXECUTION_ID",
            self.options.context.execution_id.clone(),
        );

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
                    log::info!("from python: {}", line);
                    stdout_lines_clone.lock().await.push(line.clone());
                    let _ = execution_storage_clone.append_log(line.as_str());
                }
            });
        });

        let stderr_task = tokio::task::spawn_blocking(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                while let Ok(Some(line)) = stderr_stream.next_line().await {
                    log::info!("from python: {}", line);
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
}

#[cfg(test)]
#[path = "python_runner.test.rs"]
mod tests;
