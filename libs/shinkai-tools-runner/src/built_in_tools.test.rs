use serde_json::Value;

use crate::built_in_tools::{get_tool, get_tools};

#[tokio::test]
async fn get_tools_all_load() {
    let tools = get_tools();
    for (tool_name, tool_definition) in tools {
        println!("creating tool instance for {}", tool_name);
        let tool_instance =
            crate::tools::tool::Tool::new(tool_definition.code.unwrap(), Value::Null, None);
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
