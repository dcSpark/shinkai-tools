use lazy_static::lazy_static;
use std::collections::HashMap;

use crate::tools::tool_definition::ToolDefinition;

lazy_static! {
    static ref TOOLS_PATHS: HashMap<&'static str, &'static ToolDefinition> = {
        let mut m = HashMap::new();
        m.insert(
            "shinkai-tool-echo",
            &*Box::leak(Box::new(
                serde_json::from_str::<ToolDefinition>(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/tools/shinkai-tool-echo/definition.json"
                )))
                .unwrap(),
            )),
        );
        m.insert(
            "shinkai-tool-weather-by-city",
            &*Box::leak(Box::new(
                serde_json::from_str::<ToolDefinition>(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/tools/shinkai-tool-weather-by-city/definition.json"
                )))
                .unwrap(),
            )),
        );
        m.insert(
            "shinkai-tool-web3-eth-balance",
            &*Box::leak(Box::new(
                serde_json::from_str::<ToolDefinition>(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/tools/shinkai-tool-web3-eth-balance/definition.json"
                )))
                .unwrap(),
            )),
        );
        m.insert(
            "shinkai-tool-web3-eth-uniswap",
            &*Box::leak(Box::new(
                serde_json::from_str::<ToolDefinition>(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/tools/shinkai-tool-web3-eth-uniswap/definition.json"
                )))
                .unwrap(),
            )),
        );
        m.insert(
            "shinkai-tool-math-exp",
            &*Box::leak(Box::new(
                serde_json::from_str::<ToolDefinition>(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/tools/shinkai-tool-math-exp/definition.json"
                )))
                .unwrap(),
            )),
        );
        m
    };
}

pub fn get_tool(name: &str) -> Option<&&ToolDefinition> {
    TOOLS_PATHS.get(name)
}

pub fn get_tools() -> Vec<(String, ToolDefinition)> {
    TOOLS_PATHS
        .iter()
        .map(|(&name, &definition)| (name.to_string(), definition.clone()))
        .collect()
}

#[cfg(test)]
#[path = "built_in_tools.test.rs"]
mod tests;
