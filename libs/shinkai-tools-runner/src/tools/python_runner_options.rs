use std::path::PathBuf;

use super::{
    execution_context::ExecutionContext, runner_type::RunnerType,
    shinkai_node_location::ShinkaiNodeLocation,
};

#[derive(Clone)]
pub struct PythonRunnerOptions {
    pub context: ExecutionContext,
    pub python_binary_path: PathBuf,
    pub code_runner_docker_image_name: String,
    pub force_runner_type: Option<RunnerType>,
    pub shinkai_node_location: ShinkaiNodeLocation,
}

impl Default for PythonRunnerOptions {
    fn default() -> Self {
        Self {
            context: ExecutionContext::default(),
            code_runner_docker_image_name: String::from("dcspark/shinkai-code-runner:0.9.0"),
            python_binary_path: PathBuf::from(if cfg!(windows) {
                "C://Users/agall/AppData/Local/Microsoft/WindowsApps/python"
            } else {
                "python"
            }),
            force_runner_type: None,
            shinkai_node_location: ShinkaiNodeLocation {
                protocol: String::from("http"),
                host: String::from("127.0.0.1"),
                port: 9550,
            },
        }
    }
}