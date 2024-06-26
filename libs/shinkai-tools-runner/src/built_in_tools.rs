use std::collections::HashMap;
use lazy_static::lazy_static;

lazy_static! {
    static ref TOOLS_PATHS: HashMap<&'static str, &'static str> = {
        let mut m = HashMap::new();
        m.insert("shinkai-tool-echo", include_str!("../../../dist/apps/shinkai-tool-echo/index.js"));
        m.insert("shinkai-tool-weather-by-city", include_str!("../../../dist/apps/shinkai-tool-weather-by-city/index.js"));
        m.insert("shinkai-tool-web3-eth-balance", include_str!("../../../dist/apps/shinkai-tool-web3-eth-balance/index.js"));
        m.insert("shinkai-tool-web3-eth-uniswap", include_str!("../../../dist/apps/shinkai-tool-web3-eth-uniswap/index.js"));
        m
    };
}

pub fn get_tool(name: &str) -> Option<&&str> {
    TOOLS_PATHS.get(name)
}

// TODO: In the future this method should return a Tool array (having name, version, code, etc)
pub fn get_tools() -> Vec<String> {
    TOOLS_PATHS.values().map(|&code| code.to_string()).collect()
}

#[cfg(test)]
#[path = "built_in_tools.test.rs"]
mod tests;
