use std::path::PathBuf;

use super::execution_context::ExecutionContext;

#[derive(Clone)]
pub struct ShinkaiNodeLocation {
    pub protocol: String,
    pub host: String,
    pub port: u16,
}

#[derive(Clone)]
pub enum RunnerType {
    Host,
    Docker,
}

#[derive(Clone)]
pub struct DenoRunnerOptions {
    pub context: ExecutionContext,
    pub deno_binary_path: PathBuf,
    pub deno_image_name: String,
    pub force_runner_type: Option<RunnerType>,
    pub shinkai_node_location: ShinkaiNodeLocation,
}

impl Default for DenoRunnerOptions {
    fn default() -> Self {
        Self {
            context: ExecutionContext::default(),
            deno_image_name: String::from("dcspark/shinkai-code-runner:0.8.1"),
            deno_binary_path: PathBuf::from(if cfg!(windows) {
                "./shinkai-tools-runner-resources/deno.exe"
            } else {
                "./shinkai-tools-runner-resources/deno"
            }),
            force_runner_type: std::env::var("CI_FORCE_RUNNER_TYPE")
                .map(|val| match val.as_str() {
                    "host" => Some(RunnerType::Host),
                    "docker" => Some(RunnerType::Docker),
                    _ => None,
                })
                .unwrap_or(None),
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("http"),
                host: String::from("127.0.0.1"),
                port: 9550,
            },
        }
    }
}
