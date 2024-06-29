use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct RunResult {
    pub data: Value,
}
