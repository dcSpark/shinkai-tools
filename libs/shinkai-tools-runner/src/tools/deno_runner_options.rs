use std::path::PathBuf;

use super::execution_context::ExecutionContext;

#[derive(Clone)]
pub struct DenoRunnerOptions {
    pub context: ExecutionContext,
    pub deno_binary_path: PathBuf,
    pub deno_image_name: String,
}

impl Default for DenoRunnerOptions {
    fn default() -> Self {
        Self {
            context: ExecutionContext::default(),
            deno_image_name: String::from("denoland/deno:alpine-2.0.6"),
            deno_binary_path: PathBuf::from(if cfg!(windows) {
                "./shinkai-tools-runner-resources/deno.exe"
            } else {
                "./shinkai-tools-runner-resources/deno"
            }),
        }
    }
}
