use std::path::PathBuf;

use super::execution_context::ExecutionContext;

#[derive(Clone)]
pub struct DenoRunnerOptions {
    pub context: ExecutionContext,
    pub deno_binary_path: PathBuf,
    pub deno_image_name: String,
    pub force_deno_in_host: bool,
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
            force_deno_in_host: std::env::var("CI_FORCE_DENO_IN_HOST")
                .map(|val| val == "true")
                .unwrap_or(false),
        }
    }
}
