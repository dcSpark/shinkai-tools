use super::quickjs_runtime::{execution_error::ExecutionError, script::Script};

pub struct Tool {
    script: Script,
}

impl Default for Tool {
    fn default() -> Self {
        Self::new()
    }
}

impl Tool {
    pub fn new() -> Self {
        Tool {
            script: Script::new(),
        }
    }

    pub async fn load_from_code(&mut self, code: &str, args: &str) -> Result<(), ExecutionError> {
        self.script.init().await;
        self.script.execute_promise::<()>(code.to_string()).await?;
        self.script
            .execute_promise::<()>(
                format!(
                    r#"
            const toolInstance = new tool.Tool({args});
        "#
                )
                .to_string(),
            )
            .await
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
        self.script
            .call_promise::<String>("toolInstance.run", args)
            .await
    }
}
