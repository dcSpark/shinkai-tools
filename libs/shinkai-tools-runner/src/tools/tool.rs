use super::{
    quickjs_runtime::{execution_error::ExecutionError, script::Script},
    run_result::RunResult,
    tool_definition::ToolDefinition,
};

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

    pub async fn load_from_code(
        &mut self,
        code: &str,
        configurations: &str,
    ) -> Result<(), ExecutionError> {
        self.script.init().await;
        self.script.execute_promise(code.to_string()).await?;
        self.script
            .execute_promise(
                format!(
                    r#"
            const toolInstance = new tool.Tool({configurations});
        "#
                )
                .to_string(),
            )
            .await?;
        Ok(())
    }

    pub async fn get_definition(&mut self) -> Result<ToolDefinition, ExecutionError> {
        let run_result = self
            .script
            .call_promise("toolInstance.getDefinition", "")
            .await?;
        Ok(serde_json::from_value::<ToolDefinition>(run_result).unwrap())
    }

    pub async fn config(&mut self, configurations: &str) -> Result<(), ExecutionError> {
        let result = self
            .script
            .call_promise("toolInstance.setConfig", configurations)
            .await;
        match result {
            Ok(_) => Ok(()),
            Err(error) => Err(error),
        }
    }

    pub async fn run(&mut self, parameters: &str) -> Result<RunResult, ExecutionError> {
        // This String generic type is hardcoded atm
        // We should decide what's is going to be the output for run method
        let run_result = self
            .script
            .call_promise("toolInstance.run", parameters)
            .await?;
        Ok(serde_json::from_value::<RunResult>(run_result).unwrap())
    }
}
