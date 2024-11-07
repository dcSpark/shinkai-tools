use std::path::PathBuf;

#[derive(Clone)]
pub struct DenoRunnerOptions {
    pub binary_path: PathBuf,
}

impl Default for DenoRunnerOptions {
    fn default() -> Self {
        Self {
            binary_path: PathBuf::from(if cfg!(windows) {
                "./shinkai-tools-runner-resources/deno.exe"
            } else {
                "./shinkai-tools-runner-resources/deno"
            }),
        }
    }
}
