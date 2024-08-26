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

    println!("Resources path: {}", resources_path.display());
    println!("Target path: {}", target_path.display());

    let shinkai_tools_backend_binary_name = if cfg!(target_os = "windows") {
        "shinkai-tools-backend.exe"
    } else {
        "shinkai-tools-backend"
    };
    let shinkai_tools_backend_source_path = resources_path.join(shinkai_tools_backend_binary_name);
    let shinkai_tools_backend_destination_path =
        target_path.join(shinkai_tools_backend_binary_name);
    println!(
        "Source path: {}",
        shinkai_tools_backend_source_path.display()
    );
    println!(
        "Backend path: {}",
        shinkai_tools_backend_destination_path.display()
    );
    fs::create_dir_all(&resources_path).unwrap_or_else(|err| {
        panic!("Failed to create resources directory: {}", err);
    });
    fs::create_dir_all(&target_path).unwrap_or_else(|err| {
        panic!("Failed to create target directory: {}", err);
    });
    if shinkai_tools_backend_source_path.exists() {
        fs::copy(
            &shinkai_tools_backend_source_path,
            &shinkai_tools_backend_destination_path,
        )
        .unwrap_or_else(|err| {
            panic!("Failed to copy backend binary to target path: {}", err);
        });
        println!("Copied backend binary to target path");
    } else {
        let cargo_version = env!("CARGO_PKG_VERSION");
        let zipped_file =
            resources_path.join(format!("shinkai-tools-backend-{}.zip", cargo_version));
        if !zipped_file.exists() {
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
            let url = format!(
                "https://download.shinkai.com/shinkai-tools-backend/binaries/production/{}/{}.zip",
                arch, cargo_version
            );

            let mut response = client
                .get(&url)
                .send()
                .expect("Failed to download backend binary");
            if !response.status().is_success() {
                panic!("Failed to download backend binary: {}", response.status());
            }

            let mut file =
                fs::File::create(&zipped_file).expect("Failed to create backend binary file");
            response
                .copy_to(&mut file)
                .expect("Failed to write backend binary to file");
            file.flush().expect("Failed to flush backend binary file");
        }

        // Unzip the downloaded file
        let zip_file = std::fs::File::open(&zipped_file).expect("Failed to read zipped binary");
        let mut archive = zip::ZipArchive::new(zip_file).expect("Failed to open zip archive");
        archive
            .extract(&resources_path)
            .expect("Failed to extract zip archive");

        fs::copy(
            &shinkai_tools_backend_source_path,
            &shinkai_tools_backend_destination_path,
        )
        .unwrap_or_else(|err| {
            panic!(
                "Failed to copy downloaded backend binary to target path: {}",
                err
            );
        });
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
                "chmod command failed with status {}: {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            );
        } else {
            println!("Successfully set executable permissions on backend binary");
        }
    }
}
