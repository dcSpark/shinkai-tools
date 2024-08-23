use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=resources/*");

    let resources_path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("shinkai-tools-runner-resources");
    let target_path =
        Path::new(&env::var("OUT_DIR").unwrap()).join("shinkai-tools-runner-resources");

    println!("Resources path: {:?}", resources_path);
    println!("Target path: {:?}", target_path);

    let shinkai_tools_backend_binary_name = if cfg!(target_os = "windows") {
        "shinkai-tools-backend.exe"
    } else {
        "shinkai-tools-backend"
    };
    let shinkai_tools_backend_source_path = resources_path.join(shinkai_tools_backend_binary_name);
    let shinkai_tools_backend_destination_path =
        target_path.join(shinkai_tools_backend_binary_name);
    println!("Source path: {:?}", shinkai_tools_backend_source_path);
    println!("Backend path: {:?}", shinkai_tools_backend_destination_path);
    if resources_path.exists() {
        fs::create_dir_all(&target_path).unwrap();
        fs::copy(
            shinkai_tools_backend_source_path,
            shinkai_tools_backend_destination_path.clone(),
        )
        .unwrap();
        println!("Copied backend binary to target path");
    } else {
        println!("Resources path does not exist");
    }

    if !cfg!(target_os = "windows") {
        let output = std::process::Command::new("chmod")
            .arg("+x")
            .arg(&shinkai_tools_backend_destination_path)
            .output()
            .expect("Failed to execute chmod command");
        if !output.status.success() {
            panic!(
                "chmod command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        } else {
            println!("Successfully set executable permissions on backend binary");
        }
    }
}
