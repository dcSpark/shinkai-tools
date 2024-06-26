#[derive(Clone, Debug)]
pub struct ExecutionError {
    message: String,
    stack: Option<String>,
}

impl ExecutionError {
    pub fn new(message: String, stack: Option<String>) -> Self {
        ExecutionError { message, stack }
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn stack(&self) -> Option<&str> {
        self.stack.as_deref()
    }
}
