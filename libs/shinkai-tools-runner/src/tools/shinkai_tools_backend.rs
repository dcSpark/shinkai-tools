use std::process::{Child, Command};

use super::shinkai_tools_backend_options::ShinkaiToolsBackendOptions;

#[derive(Default)]
pub struct ShinkaiToolsBackend {
    child: Option<Child>,
    options: ShinkaiToolsBackendOptions,
}

impl ShinkaiToolsBackend {
    pub fn new(options: ShinkaiToolsBackendOptions) -> Self {
        ShinkaiToolsBackend {
            options,
            ..Default::default()
        }
    }

    pub async fn run(&mut self) -> Result<(), std::io::Error> {
        if self.child.is_some() {
            println!("Killing existing child process.");
            self.kill().await?;
        }

        let child_process = Command::new(self.options.binary_path.clone())
            .env("PORT", self.options.api_port.to_string())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                println!("Error spawning child process: {}", e);
                e
            })?;
        let pid = child_process.id();
        self.child = Some(child_process);
        println!("Started new child process with PID: {}", pid);

        let client = reqwest::Client::new();

        // Wait for the /health endpoint to respond with 200
        let health_check_url = format!("http://127.0.0.1:{}/health", self.options.api_port).to_string();
        let mut retries = 5;
        while retries > 0 {
            match client.get(health_check_url.clone()).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        println!("shinkai-tools-backend /health successful.");
                        break;
                    } else {
                        println!(
                            "shinkai-tools-backend /health failed status: {}, code: {}, text: {}, retrying...",
                            response.status(),
                            response.status().as_u16(),
                            response.text().await.unwrap_or_else(|_| "".to_string())
                        );
                    }
                }
                Err(e) => {
                    println!("shinkai-tools-backend /health failed: {}, retrying...", e);
                }
            }
            retries -= 1;
            if retries <= 0 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!(
                        "shinkai-tools-backend /health timeout after {} retries",
                        5 - retries
                    ),
                ));
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
        Ok(())
    }

    // Method to kill the child process
    pub async fn kill(&mut self) -> Result<(), std::io::Error> {
        if let Some(mut child) = self.child.take() {
            tokio::task::spawn_blocking(move || child.kill()).await??;
            self.child = None;
        }
        println!("Killing the child process if it exists.");
        Ok(())
    }
}
