use std::path::PathBuf;

#[derive(Clone)]
pub struct ExecutionContext {
    pub context_id: String,
    pub execution_id: String,
    pub code_id: String,
    pub storage: PathBuf,
}

impl Default for ExecutionContext {
    fn default() -> Self {
        Self {
            context_id: nanoid::nanoid!(),
            execution_id: nanoid::nanoid!(),
            code_id: nanoid::nanoid!(),
            storage: PathBuf::from("./shinkai-tools-runner-execution-storage"),
        }
    }
}
