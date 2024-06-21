use std::path::Path;
use super::script::Script;

pub struct Tool {
    script: Script
}

impl Tool {
    pub fn new() -> Self {
        Tool { script: Script::new() }
    }

    pub async fn load(&mut self, file: impl AsRef<Path>) {
        self.script.init().await;
        let _ = self.script.from_file(file).await;
        let _ = self.script.execute_promise::<()>(r#"
            const toolInstance = new tool.Tool();
        "#.to_string()).await;
    }
    pub async fn run(&mut self, args: &str) {
        // This String generic type is hardcoded atm
        // We should decide what's is going to be the output for run method
        let result = self.script.call_promise::<String>("toolInstance.run", args).await;
        match result {
            Ok(result) => {
                println!("run result {}", result);
            },
            Err(e) => {
                println!("run error result {}", e.message());
            }
        }
    }
}
