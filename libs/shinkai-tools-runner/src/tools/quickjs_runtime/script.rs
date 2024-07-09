use std::time::Duration;

use super::context_globals::init_globals;
use super::execution_error::ExecutionError;

use nanoid::nanoid;
use rquickjs::{async_with, AsyncContext, AsyncRuntime, Object, Value};

pub struct Script {
    runtime: Option<AsyncRuntime>,
    context: Option<AsyncContext>,
    terminate: bool,
}

impl Script {
    pub fn new() -> Self {
        Script {
            runtime: None,
            context: None,
            terminate: false,
        }
    }

    pub async fn init(&mut self) {
        let (runtime, context) = self.build_runtime().await;
        self.runtime = Some(runtime);
        self.context = Some(context);
        let terminate = self.terminate;
        self.runtime
            .as_ref()
            .unwrap()
            .set_interrupt_handler(Some(Box::new(move || terminate)))
            .await;
    }

    async fn build_runtime(&self) -> (AsyncRuntime, AsyncContext) {
        let runtime: AsyncRuntime = AsyncRuntime::new().unwrap();
        runtime.set_memory_limit(1024 * 1024 * 1024).await; // 1 GB
        runtime.set_max_stack_size(1024 * 1024).await; // 1 MB
        let context = AsyncContext::full(&runtime).await;
        context
            .as_ref()
            .unwrap()
            .with(|ctx| {
                let _ = init_globals(&ctx);
            })
            .await;
        (runtime, context.unwrap())
    }

    pub async fn call_promise(
        &mut self,
        fn_name: &str,
        json_args: &str,
        max_execution_time_ms: u64,
    ) -> Result<serde_json::Value, ExecutionError> {
        println!("calling fn:{}", fn_name);
        let js_code: String = format!("await {fn_name}({json_args})");
        self.execute_promise(js_code, max_execution_time_ms).await
    }

    pub async fn execute_promise(
        &mut self,
        js_code: String,
        max_execution_time_ms: u64,
    ) -> Result<serde_json::Value, ExecutionError> {
        let id = nanoid!();
        let id_clone = id.clone();
        println!(
            "id:{} executing code:{}...",
            id.clone(),
            &js_code[..20.min(js_code.len())]
        );
        let js_code_clone = js_code.clone(); // Clone js_code here
        let context_clone = self.context.clone().unwrap();
        let result = async_with!(context_clone => |ctx|{
            let eval_promise_result = ctx.eval_promise::<_>(js_code);

            let result = eval_promise_result.unwrap().into_future::<Object>().await.map_err(|e| {
                let exception = ctx.catch().try_into_exception();
                if let Ok(exception) = exception {
                    let message = exception.message().unwrap_or_default();
                    let stack = exception.stack().unwrap_or_default();

                    // Extract line number from stack trace
                    let line_number = stack.lines()
                        .find_map(|line| line.split(':').nth(1))
                        .and_then(|num| num.parse::<usize>().ok())
                        .unwrap_or(0);

                    // Get the problematic line of code
                    let error_line = js_code_clone.lines().nth(line_number.saturating_sub(1))
                        .unwrap_or("Unable to retrieve the exact line");

                    println!("id:{} Error: {}", id.clone(), message);
                    println!("Stack trace:\n{}", stack);
                    println!("Problematic line ({}): {}", line_number, error_line);

                    ExecutionError::new(message, Some(stack))
                } else {
                    println!("id:{} Error: {}", id.clone(), e);
                    ExecutionError::new(e.to_string(), None)
                }
            });
            match result {
                Ok(wrapped_value) => {
                    if let Ok(Some(json_str)) = ctx.json_stringify(wrapped_value.as_ref()) {
                        let json_str: String = json_str.to_string().expect("Failed to convert to String"); // Convert to Rust String
                        println!("id:{} value from code execution result {}", id.clone(), &json_str[..500.min(json_str.len())]);
                    }
                    let js_value = wrapped_value.get::<&str, Value>("value").map_err(|e| {
                        ExecutionError::new(e.to_string(), None)
                    })?;
                    let stringifyed_js_value = ctx.json_stringify(js_value).map_err(|e| {
                        ExecutionError::new(e.to_string(), None)
                    })?;
                    if stringifyed_js_value.is_none() {
                        return Ok(serde_json::Value::Null);
                    }
                    let stringifyed_value = stringifyed_js_value.unwrap().to_string().map_err(|e| {
                        ExecutionError::new(e.to_string(), None)
                    })?;
                    let value = serde_json::from_str::<serde_json::Value>(&stringifyed_value).map_err(|e| {
                        ExecutionError::new(e.to_string(), None)
                    })?;
                    Ok(value)
                }
                Err(error) => {
                    return Err(error)
                }
            }
        });
        tokio::select! {
            result = result => {
                if let Some(error) = result.as_ref().err() {
                    println!("id:{} run error result: {}", id_clone, error.message());
                }
                result
            }
            _ = tokio::time::sleep(Duration::from_millis(max_execution_time_ms)) => {
                println!("sending termination signal");
                self.terminate = true;
                Err(ExecutionError::new("max execution time reached".to_string(), None))
            }
        }
    }
}
