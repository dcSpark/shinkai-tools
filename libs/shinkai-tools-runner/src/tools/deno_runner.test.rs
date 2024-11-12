use std::collections::HashMap;

use crate::tools::deno_runner::DenoRunner;

#[tokio::test]
async fn test_run_echo_tool() {
    let mut deno_runner = DenoRunner::default();
    let code = r#"
      console.log('{"message":"hello world"}');
    "#;

    let result = deno_runner.run(code, None, None).await.unwrap();

    assert_eq!(result, "{\"message\":\"hello world\"}\n");
}

#[tokio::test]
async fn test_run_with_env() {
    let mut deno_runner = DenoRunner::default();
    let code = r#"
      console.log(process.env.HELLO_WORLD);
    "#;

    let mut envs = HashMap::<String, String>::new();
    envs.insert("HELLO_WORLD".to_string(), "hello world!".to_string()); // Insert the key-value pair
    let result = deno_runner.run(code, Some(envs), None).await.unwrap();

    assert_eq!(result, "hello world!\n");
}
