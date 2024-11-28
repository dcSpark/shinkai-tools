use crate::built_in_tools::{get_tool, get_tools};

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
