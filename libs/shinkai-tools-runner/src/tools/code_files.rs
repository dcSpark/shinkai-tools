use std::collections::HashMap;

#[derive(Default, Clone)]
pub struct CodeFiles {
    pub files: HashMap<String, String>,
    pub entrypoint: String,
}
