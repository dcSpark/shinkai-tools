use serde_json::Value;

use crate::built_in_tools::{get_tool, get_tools};

#[tokio::test]
async fn get_tools_all_load() {
    let tools = get_tools();
    for (tool_name, tool_definition) in tools {
        let mut tool_instance = crate::tools::tool::Tool::new(tool_definition.code.unwrap(), Value::Null);
        let defintion = tool_instance
            .get_definition()
            .await;
        assert_eq!(defintion.as_ref().unwrap().id, tool_name);
        assert!(defintion.is_ok(), "Tool {} failed to load", tool_name);
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
