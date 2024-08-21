use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=resources/*");

    let resources_path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("shinkai-tools-runner-resources");
    let target_path =
        Path::new(&env::var("OUT_DIR").unwrap()).join("shinkai-tools-runner-resources");

    if resources_path.exists() {
        fs::create_dir_all(&target_path).unwrap();
        for entry in fs::read_dir(resources_path).unwrap() {
            let entry = entry.unwrap();
            let file_name = entry.file_name();
            let source = entry.path();
            let destination = target_path.join(file_name);
            fs::copy(source, destination).unwrap();
        }
    }

    let backend_path = target_path.join("shinkai-tools-backend");

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
