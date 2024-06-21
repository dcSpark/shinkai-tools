use std::path::Path;
use rquickjs::{async_with, AsyncContext, AsyncRuntime, FromJs};
use nanoid::nanoid;
use crate::quickjs_runtime::execution_error::ExecutionError;

pub struct Script {
    runtime: Option<AsyncRuntime>,
    context: Option<AsyncContext>,
}

impl Script {
    pub fn new() -> Self {
        Script { runtime: None, context: None }
    }

    pub async fn init(&mut self) {
        let (runtime, context) = Self::build_runtime().await;
        self.runtime = Some(runtime);
        self.context = Some(context);
    }

    async fn build_runtime() -> (AsyncRuntime, AsyncContext) {
        let runtime: AsyncRuntime = AsyncRuntime::new().unwrap();
        let context = AsyncContext::full(&runtime).await;
        (runtime, context.unwrap())
    }

    pub async fn from_file(&mut self, file: impl AsRef<Path>) -> Result<(), ExecutionError> {
        println!("loading script from file path:{}", file.as_ref().to_str().unwrap());
        let js_code: String = std::fs::read_to_string(file).unwrap();
		self.execute_promise(js_code).await
	}

    pub async fn call_promise<T: for<'js> FromJs<'js> + 'static>(&mut self, fn_name: &str, json_args: &str) -> Result<T, ExecutionError> {
        println!("calling fn:{}", fn_name);
        let js_code: String = format!(
            "await {fn_name}({json_args})"
		);
        self.execute_promise::<T>(js_code).await
    }

    pub async fn execute_promise<T: for<'js> FromJs<'js> + 'static>(&mut self, js_code: String) -> Result<T, ExecutionError> {
        let id = nanoid!();
        println!("execute id:{}\n code:{}", id, js_code);
        let result = async_with!(self.context.clone().unwrap() => |ctx|{
            let eval_promise_result = ctx.eval_promise::<_>(js_code);

            let result = eval_promise_result.unwrap().into_future::<T>().await.map_err(|e| {
                let exception = ctx.catch().try_into_exception();
                if exception.is_ok() {
                    let message = exception.clone().unwrap().message().unwrap();
                    let stack = exception.clone().unwrap().stack();
                    return ExecutionError::new(message, stack);
                }
                return ExecutionError::new(e.to_string(), None);
            });
            result
        }).await;
        result
    }
}
