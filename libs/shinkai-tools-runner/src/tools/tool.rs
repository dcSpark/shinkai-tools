use std::time::Duration;

use reqwest::{header, Client};
use serde_json::Value;

use super::{
    execution_error::ExecutionError, run_result::RunResult,
    shinkai_tools_backend::ShinkaiToolsBackend, tool_definition::ToolDefinition,
};

pub struct Tool {
    tool_backend_url: String,
    code: String,
    configurations: Value,
    http_client: Client,
}

impl Tool {
    pub const MAX_EXECUTION_TIME_MS_INTERNAL_OPS: u64 = 1000;

    pub fn new(code: String, configurations: Value) -> Self {
        Tool {
            tool_backend_url: "http://127.0.0.1:3000".to_string(),
            code,
            configurations,
            http_client: Self::build_http_client(),
        }
    }

    pub fn build_http_client() -> Client {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            "Content-Type",
            header::HeaderValue::from_static("application/json"),
        );
        Client::builder().default_headers(headers).build().unwrap()
    }

    async fn internal_get_definition(&self) -> Result<ToolDefinition, ExecutionError> {
        println!("Preparing to get tool definition for code: {}", self.code);

        let body = serde_json::json!({
            "code": self.code,
        })
        .to_string();
        println!("Request body for tool definition: {}", body);

        let response = self
            .http_client
            .post(format!("{}/tool/definition", self.tool_backend_url))
            .body(body)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| {
                println!("Failed to get tool definition: {}", e);
                ExecutionError::new(format!("Failed to get tool definition: {}", e), None)
            })?;

        println!("Received response with status: {}", response.status());

        if response.status() != reqwest::StatusCode::OK {
            println!("Unexpected response status: {}", response.status());
            return Err(ExecutionError::new(
                format!("Unexpected response status: {}", response.status()),
                None,
            ));
        }

        let response_text = response.text().await.map_err(|e| {
            println!("Failed to read response text: {}", e);
            ExecutionError::new(format!("Failed to read response text: {}", e), None)
        })?;
        println!("Response text: {}", response_text);

        let tool_definition: ToolDefinition =
            serde_json::from_str(&response_text).map_err(|e| {
                println!("Failed to parse tool definition: {}", e);
                ExecutionError::new(format!("Failed to parse tool definition: {}", e), None)
            })?;
        println!(
            "Successfully retrieved tool definition: {:?}",
            tool_definition
        );
        Ok(tool_definition)
    }

    pub async fn get_definition(&mut self) -> Result<ToolDefinition, ExecutionError> {
        let mut shinkai_tool_backend = ShinkaiToolsBackend::default();
        let _ = shinkai_tool_backend.run().await;
        let result = self.internal_get_definition().await;
        let _ = shinkai_tool_backend.kill().await;
        result
    }

    async fn internal_run(
        &self,
        parameters: Value,
        max_execution_time_s: Option<u64>,
    ) -> Result<RunResult, ExecutionError> {
        println!("Preparing to run tool");
        println!("Configurations: {:?}", self.configurations);
        println!("Parameters: {:?}", parameters);

        let body = serde_json::json!({
            "code": self.code,
            "configurations": self.configurations,
            "parameters": parameters,
        })
        .to_string();

        println!(
            "Sending request to run tool at: {}/tool/run",
            self.tool_backend_url
        );
        let response = self
            .http_client
            .post(format!("{}/tool/run", self.tool_backend_url))
            .header("Content-Type", "application/json")
            .body(body)
            .timeout(Duration::from_secs(max_execution_time_s.unwrap_or(60)))
            .send()
            .await
            .map_err(|e| {
                println!("Failed to run tool: {}", e);
                ExecutionError::new(format!("Failed to run tool: {}", e), None)
            })?;

        println!("Received response with status: {}", response.status());
        if response.status() != reqwest::StatusCode::OK {
            println!("Unexpected response status: {}", response.status());
            return Err(ExecutionError::new(
                format!("Unexpected response status: {}", response.status()),
                None,
            ));
        }

        println!("Parsing response text for /tool/run.");
        let response_text = response.text().await.map_err(|e| {
            println!("Failed to read response text: {}", e);
            ExecutionError::new(format!("Failed to read response text: {}", e), None)
        })?;

        println!("Response text: {}", response_text);
        let tool_definition: RunResult = serde_json::from_str(&response_text).map_err(|e| {
            println!("Failed to parse run result: {}", e);
            ExecutionError::new(format!("Failed to parse run result: {}", e), None)
        })?;

        println!("Successfully parsed run result: {:?}", tool_definition);
        Ok(tool_definition)
    }

    pub async fn run(
        &self,
        parameters: Value,
        max_execution_time_s: Option<u64>,
    ) -> Result<RunResult, ExecutionError> {
        let mut shinkai_tool_backend = ShinkaiToolsBackend::default();
        let _ = shinkai_tool_backend.run().await;
        let result = self.internal_run(parameters, max_execution_time_s).await;
        let _ = shinkai_tool_backend.kill().await;
        result
    }
}
