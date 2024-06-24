use rquickjs::Object;
use std::path::Path;

use super::{execution_error::ExecutionError, script::Script};

pub struct Tool {
    script: Script,
}

impl Tool {
    pub fn new() -> Self {
        Tool {
            script: Script::new(),
        }
    }

    pub async fn load_from_path(
        &mut self,
        file: impl AsRef<Path>,
        args: &str,
    ) -> Result<(), ExecutionError> {
        self.script.init().await;
        let load_script_from_file_result = self.script.from_file(file).await;
        if load_script_from_file_result.is_err() {
            return load_script_from_file_result;
        }
        let result = self
            .script
            .execute_promise::<()>(
                format!(
                    r#"
            const toolInstance = new tool.Tool({args});
        "#
                )
                .to_string(),
            )
            .await;
        result
    }

    pub async fn load_from_code(&mut self, code: &str, args: &str) -> Result<(), ExecutionError> {
        self.script.init().await;
        let result = self.script.execute_promise::<()>(code.to_string()).await;
        if result.is_err() {
            return result;
        }
        let result = self
            .script
            .execute_promise::<()>(
                format!(
                    r#"
            const toolInstance = new tool.Tool({args});
        "#
                )
                .to_string(),
            )
            .await;
        result
    }

    pub async fn config(&mut self, args: &str) -> Result<(), ExecutionError> {
        let result = self
            .script
            .call_promise::<()>("toolInstance.setConfig", args)
            .await;
        match result {
            Ok(_) => Ok(()),
            Err(error) => Err(error),
        }
    }
    pub async fn run(&mut self, args: &str) -> Result<String, ExecutionError> {
        // This String generic type is hardcoded atm
        // We should decide what's is going to be the output for run method
        let result = self
            .script
            .call_promise::<String>("toolInstance.run", args)
            .await;
        result
    }
}
