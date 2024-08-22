use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=resources/*");

    let resources_path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("shinkai-tools-runner-resources");
    let target_path =
        Path::new(&env::var("OUT_DIR").unwrap()).join("shinkai-tools-runner-resources");

    let shinkai_tools_backend_binary_name = if cfg!(target_os = "windows") {
        "shinkai-tools-backend.exe"
    } else {
        "shinkai-tools-backend"
    };
    let source = resources_path.join(shinkai_tools_backend_binary_name);
    let backend_path = target_path.join("shinkai-tools-backend");
    if resources_path.exists() {
        fs::create_dir_all(&target_path).unwrap();
        fs::copy(source, backend_path.clone()).unwrap();
    }

    if !cfg!(target_os = "windows") {
        let output = std::process::Command::new("chmod")
            .arg("+x")
            .arg(&backend_path)
            .output()
            .expect("Failed to execute chmod command");
        if !output.status.success() {
            panic!(
                "chmod command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }
}
