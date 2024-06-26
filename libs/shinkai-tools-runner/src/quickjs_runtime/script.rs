use crate::quickjs_runtime::context_globals::console_log::console_log;
use crate::quickjs_runtime::context_globals::fetch::fetch;
use crate::quickjs_runtime::context_globals::set_timeout::set_timeout_spawn;
use crate::quickjs_runtime::execution_error::ExecutionError;
use nanoid::nanoid;
use rquickjs::{async_with, function::Func, AsyncContext, AsyncRuntime, FromJs, Object};
use std::path::Path;
pub struct Script {
    runtime: Option<AsyncRuntime>,
    context: Option<AsyncContext>,
}

impl Script {
    pub fn new() -> Self {
        Script {
            runtime: None,
            context: None,
        }
    }

    pub async fn init(&mut self) {
        let (runtime, context) = Self::build_runtime().await;
        self.runtime = Some(runtime);
        self.context = Some(context);
    }

    async fn build_runtime() -> (AsyncRuntime, AsyncContext) {
        let runtime: AsyncRuntime = AsyncRuntime::new().unwrap();
        runtime.set_memory_limit(1024 * 1024 * 1024).await; // 1 GB
        runtime.set_max_stack_size(1024 * 1024).await; // 1 MB
        let context = AsyncContext::full(&runtime).await;
        (runtime, context.unwrap())
    }

    pub async fn from_file(&mut self, file: impl AsRef<Path>) -> Result<(), ExecutionError> {
        println!(
            "loading script from file path:{}",
            file.as_ref().to_str().unwrap()
        );
        let js_code: String = std::fs::read_to_string(file).unwrap();
        self.execute_promise(js_code).await
    }

    pub async fn call_promise<T: for<'js> FromJs<'js> + 'static>(
        &mut self,
        fn_name: &str,
        json_args: &str,
    ) -> Result<T, ExecutionError> {
        println!("calling fn:{}", fn_name);
        let js_code: String = format!("await {fn_name}({json_args})");
        self.execute_promise::<T>(js_code).await
    }

    pub async fn execute_promise<T: for<'js> FromJs<'js> + 'static>(
        &mut self,
        js_code: String,
    ) -> Result<T, ExecutionError> {
        let id = nanoid!();
        let id_clone = id.clone();
        println!(
            "id:{} executing code:{}...",
            id.clone(),
            &js_code[..20.min(js_code.len())]
        );
        let js_code_clone = js_code.clone(); // Clone js_code here
        let result = async_with!(self.context.clone().unwrap() => |ctx|{
            let globals = ctx.globals();
            let console = Object::new(ctx.clone()).unwrap();
            let _ = console.set("log", Func::from(console_log));
            let _ = globals.set("console", console);
            let _ = globals.set("fetch", Func::from(fetch));
            let _ = globals.set("setTimeout", Func::from(set_timeout_spawn));

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
                        println!("id:{} value from code execution result {}", id.clone(), json_str);
                    }
                    let value = wrapped_value.get::<&str, T>("value").map_err(|e| {
                        ExecutionError::new(e.to_string(), None)
                    });
                    return value
                }
                Err(error) => {
                    return Err(error)
                }
            }
        })
        .await;
        if let Some(error) = result.as_ref().err() {
            println!("id:{} run error result: {}", id_clone, error.message());
        }
        result
    }
}
