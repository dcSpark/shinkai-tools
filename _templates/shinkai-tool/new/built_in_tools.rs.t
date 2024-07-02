---
inject: true
to: libs/shinkai-tools-runner/src/built_in_tools.rs
before: "// ntim:"
---
        m.insert(
            "shinkai-tool-<%= name %>",
            &*Box::leak(Box::new(
                serde_json::from_str::<ToolDefinition>(include_str!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/tools/shinkai-tool-<%= name %>/definition.json"
                )))
                .unwrap(),
            )),
        );