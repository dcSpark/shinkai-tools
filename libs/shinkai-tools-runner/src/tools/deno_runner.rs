use std::{collections::HashMap, process::Command};

use super::deno_runner_options::DenoRunnerOptions;

#[derive(Default)]
pub struct DenoRunner {
    options: DenoRunnerOptions,
}

impl DenoRunner {
    const DENO_PERMISSIONS: [&'static str; 4] = [
        "--allow-all",
        "--deny-write=/etc",
        "--deny-write=/usr",
        "--deny-write=C:\\Windows",
    ];
    pub fn new(options: DenoRunnerOptions) -> Self {
        DenoRunner { options }
    }

    pub async fn run(
        &mut self,
        code: &str,
        envs: HashMap<String, String>,
        max_execution_time_s: Option<u64>,
    ) -> Result<String, std::io::Error> {
        log::info!("using deno binary at path: {:?}", self.options.binary_path);
        let binary_path = self.options.binary_path.clone();

        let temp_file = tempfile::NamedTempFile::new()?;
        log::info!("created temporary file for code at: {:?}", temp_file.path());
        std::fs::write(temp_file.path(), code).map_err(|e| {
            log::error!("failed to write code to temporary file: {}", e);
            e
        })?;

        let mut command = tokio::process::Command::new(binary_path);
        let command = command
            .args(["run", "--ext", "ts"])
            .args(DenoRunner::DENO_PERMISSIONS)
            .arg(temp_file.path().to_str().unwrap())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .envs(envs)
            .kill_on_drop(true);
        log::info!("prepared command with arguments: {:?}", command);
        let child = command.spawn()?;

        let output = if let Some(timeout) = max_execution_time_s {
            let timeout_duration = std::time::Duration::from_millis(timeout);
            log::info!("executing command with {}ms timeout", timeout);
            match tokio::time::timeout(timeout_duration, child.wait_with_output()).await {
                Ok(result) => result?,
                Err(_) => {
                    log::error!("command execution timed out after {}ms", timeout);
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        format!("process timed out after {} seconds", timeout),
                    ));
                }
            }
        } else {
            log::info!("executing command without timeout");
            child.wait_with_output().await?
        };
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            log::error!("command execution failed: {}", error);
            return Err(std::io::Error::new(std::io::ErrorKind::Other, error));
        }

        let output = String::from_utf8_lossy(&output.stdout);

        log::info!("command completed successfully with output: {}", output);
        Ok(output.to_string())
    }
}

#[cfg(test)]
#[path = "deno_runner.test.rs"]
mod tests;
