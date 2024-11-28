use std::{collections::HashMap, time::Duration};

use serde_json::Value;

use super::{
    code_files::CodeFiles, deno_runner::DenoRunner, deno_runner_options::DenoRunnerOptions,
    execution_error::ExecutionError, run_result::RunResult,
};

pub struct Tool {
    code: CodeFiles,
    configurations: Value,
    deno_runner_options: DenoRunnerOptions,
}

impl Tool {
    pub const MAX_EXECUTION_TIME_MS_INTERNAL_OPS: u64 = 1000;

    pub fn new(
        code_files: CodeFiles,
        configurations: Value,
        deno_runner_options: Option<DenoRunnerOptions>,
    ) -> Self {
        let options = deno_runner_options.unwrap_or_default();
        Tool {
            code: code_files,
            configurations,
            deno_runner_options: options,
        }
    }

    pub async fn check(&self) -> anyhow::Result<Vec<String>> {
        let mut deno_runner = DenoRunner::new(self.deno_runner_options.clone());
        let code = self.code.clone();
        deno_runner.check(code).await
    }

    pub async fn run(
        &self,
        envs: Option<HashMap<String, String>>,
        parameters: Value,
        max_execution_timeout: Option<Duration>,
    ) -> Result<RunResult, ExecutionError> {
        log::info!("preparing to run tool");
        log::info!("configurations: {}", self.configurations.to_string());
        log::info!("parameters: {}", parameters.to_string());

        let mut deno_runner = DenoRunner::new(self.deno_runner_options.clone());
        let mut code = self.code.clone();
        let entrypoint_code = code.files.get(&self.code.entrypoint.clone());
        if let Some(entrypoint_code) = entrypoint_code {
            let adapted_entrypoint_code = format!(
                r#"
            {}
            const configurations = JSON.parse('{}');
            const parameters = JSON.parse('{}');

            const result = await run(configurations, parameters);
            const adaptedResult = result === undefined ? null : result;
            console.log("<shinkai-tool-result>");
            console.log(JSON.stringify(adaptedResult));
            console.log("</shinkai-tool-result>");
        "#,
                &entrypoint_code,
                serde_json::to_string(&self.configurations)
                    .unwrap()
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\"", "\\\"")
                    .replace("`", "\\`"),
                serde_json::to_string(&parameters)
                    .unwrap()
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\"", "\\\"")
                    .replace("`", "\\`")
            );
            code.files
                .insert(self.code.entrypoint.clone(), adapted_entrypoint_code);
        }

        let result = deno_runner
            .run(code.clone(), envs, max_execution_timeout)
            .await
            .map_err(|e| ExecutionError::new(format!("failed to run deno: {}", e), None))?;

        let result_text = result
            .iter()
            .skip_while(|line| !line.contains("<shinkai-tool-result>"))
            .skip(1)
            .take_while(|line| !line.contains("</shinkai-tool-result>"))
            .map(|s| s.to_string())
            .collect::<Vec<String>>()
            .join("\n");

        log::info!("result text: {:?}", result);

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
