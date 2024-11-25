use std::collections::HashMap;

use serde_json::Value;

use crate::{
    built_in_tools::{get_tool, get_tools},
    tools::code_files::CodeFiles,
};

#[tokio::test]
async fn get_tools_all_load() {
    let _ = env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .is_test(true)
        .try_init();
    let tools = get_tools();
    for (tool_name, tool_definition) in tools {
        println!("creating tool instance for {}", tool_name);
        let code_files = CodeFiles {
            files: HashMap::from([("main.ts".to_string(), tool_definition.code.unwrap())]),
            entrypoint: "main.ts".to_string(),
        };
        let tool_instance = crate::tools::tool::Tool::new(code_files, Value::Null, None);
        println!("fetching definition for {}", tool_name);
        let defintion = tool_instance.definition().await;
        println!(
            "definition load successfully for {}: {:?}",
            tool_name,
            defintion.clone().unwrap().id
        );
        assert_eq!(defintion.as_ref().unwrap().id, tool_name);
        assert!(defintion.is_ok(), "tool {} failed to load", tool_name);
    }
}

#[tokio::test]
async fn list_tools_count() {
    assert!(get_tools().len() >= 5);
}

#[tokio::test]
async fn get_tool_unexisting() {
    let tool = get_tool("unexisting");
    assert!(tool.is_none());
}

#[tokio::test]
async fn get_tools_existing() {
    let tool = get_tool("shinkai-tool-echo");
    assert!(tool.is_some());
}
