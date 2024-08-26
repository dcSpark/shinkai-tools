use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=shinkai-tools-runner-resources/*");
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
    fs::create_dir_all(&target_path).unwrap();
    if resources_path.exists() {
        fs::copy(
            shinkai_tools_backend_source_path,
            shinkai_tools_backend_destination_path.clone(),
        )
        .unwrap();
        println!("Copied backend binary to target path");
    } else {
        println!("Resources path does not exist, fetching from internet");
        let client = reqwest::blocking::Client::new();
        let arch = if cfg!(target_os = "linux") {
            "x86_64-unknown-linux-gnu"
        } else if cfg!(target_os = "macos") {
            "aarch64-apple-darwin"
        } else if cfg!(target_os = "windows") {
            "x86_64-pc-windows-msvc"
        } else {
            panic!("Unsupported target OS");
        };
        let url = format!("https://download.shinkai.com/shinkai-tools-backend/binaries/production/{}/{}/shinkai-tools-backend{}",
            arch,
            env!("CARGO_PKG_VERSION"),
            if cfg!(windows) { ".exe" } else { "" }
        );
        let mut response = client
            .get(&url)
            .send()
            .expect("Failed to download backend binary");
        if !response.status().is_success() {
            panic!("Failed to download backend binary: {}", response.status());
        }
        fs::create_dir_all(&resources_path).unwrap();
        let mut file = fs::File::create(&shinkai_tools_backend_source_path)
            .expect("Failed to create backend binary file");
        response
            .copy_to(&mut file)
            .expect("Failed to write backend binary to file");
        file.flush().expect("error writing data");
        fs::copy(
            shinkai_tools_backend_source_path,
            shinkai_tools_backend_destination_path.clone(),
        )
        .unwrap();
        println!("Downloaded and copied backend binary to target path");
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
