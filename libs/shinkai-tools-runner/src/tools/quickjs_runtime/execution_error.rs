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

impl std::fmt::Display for ExecutionError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
      write!(f, "ExecutionError: {}", self.message)
  }
}
