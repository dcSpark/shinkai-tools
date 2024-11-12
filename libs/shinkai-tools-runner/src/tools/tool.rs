use std::collections::HashMap;

use serde_json::Value;

use super::{
    deno_runner::DenoRunner, deno_runner_options::DenoRunnerOptions,
    execution_error::ExecutionError, run_result::RunResult, tool_definition::ToolDefinition,
};

pub struct Tool {
    code: String,
    configurations: Value,
    deno_runner_options: DenoRunnerOptions,
}

impl Tool {
    pub const MAX_EXECUTION_TIME_MS_INTERNAL_OPS: u64 = 1000;

    pub fn new(
        code: String,
        configurations: Value,
        deno_runner_options: Option<DenoRunnerOptions>,
    ) -> Self {
        let options = deno_runner_options.unwrap_or_default();
        Tool {
            code,
            configurations,
            deno_runner_options: options,
        }
    }

    pub async fn definition(&self) -> Result<ToolDefinition, ExecutionError> {
        log::info!("preparing to get tool definition from code");

        let mut deno_runner = DenoRunner::new(self.deno_runner_options.clone());

        // Empty envs when get definition
        let code = format!(
            r#"
            {}
            console.log("<shinkai-tool-definition>");
            console.log(JSON.stringify(definition));
            console.log("</shinkai-tool-definition>");
        "#,
            &self.code.to_string()
        );
        let result = deno_runner
            .run(&code, None, None)
            .await
            .map_err(|e| ExecutionError::new(format!("failed to run deno: {}", e), None))?;

        let result_text = result
            .lines()
            .skip_while(|line| !line.contains("<shinkai-tool-definition>"))
            .skip(1)
            .take_while(|line| !line.contains("</shinkai-tool-definition>"))
            .collect::<Vec<&str>>()
            .join("\n");

        log::info!("result text: {}", result_text);

        let tool_definition: ToolDefinition = serde_json::from_str(&result_text).map_err(|e| {
            log::info!("failed to parse tool definition: {}", e);
            ExecutionError::new(format!("failed to parse tool definition: {}", e), None)
        })?;

        log::info!(
            "successfully retrieved tool definition: {:?}",
            tool_definition
        );
        Ok(tool_definition)
    }

    pub async fn run(
        &self,
        envs: Option<HashMap<String, String>>,
        parameters: Value,
        max_execution_time_s: Option<u64>,
    ) -> Result<RunResult, ExecutionError> {
        log::info!("preparing to run tool");
        log::info!("configurations: {}", self.configurations.to_string());
        log::info!("parameters: {}", parameters.to_string());

        let mut deno_runner = DenoRunner::new(self.deno_runner_options.clone());
        let code = format!(
            r#"
            {}
            const configurations = JSON.parse('{}');
            const parameters = JSON.parse('{}');

            const result = await run(configurations, parameters);
            console.log("<shinkai-tool-result>");
            console.log(JSON.stringify(result));
            console.log("</shinkai-tool-result>");
        "#,
            &self.code.to_string(),
            serde_json::to_string(&self.configurations)
                .unwrap()
                .replace("\\", "\\\\"),
            serde_json::to_string(&parameters)
                .unwrap()
                .replace("\\", "\\\\"),
        );
        let result = deno_runner
            .run(&code, envs, max_execution_time_s)
            .await
            .map_err(|e| ExecutionError::new(format!("failed to run deno: {}", e), None))?;

        let result_text = result
            .lines()
            .skip_while(|line| !line.contains("<shinkai-tool-result>"))
            .skip(1)
            .take_while(|line| !line.contains("</shinkai-tool-result>"))
            .collect::<Vec<&str>>()
            .join("\n");

        log::info!("result text: {}", result_text);

        let result: Value = serde_json::from_str(&result_text).map_err(|e| {
            log::info!("failed to parse result: {}", e);
            ExecutionError::new(format!("failed to parse result: {}", e), None)
        })?;
        log::info!("successfully parsed run result: {:?}", result);
        Ok(RunResult { data: result })
    }
}

#[cfg(test)]
#[path = "tool.test.rs"]
mod tests;
