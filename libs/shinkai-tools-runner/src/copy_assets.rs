use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;

pub fn add_exec_permissions(binary_path: &PathBuf) -> Result<(), std::io::Error> {
    if !cfg!(target_os = "windows") {
        let output = std::process::Command::new("chmod")
            .arg("+x")
            .arg(binary_path)
            .output()
            .expect("failed to execute chmod command");
        if !output.status.success() {
            panic!(
                "chmod command failed with status {}: {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            );
        } else {
            println!(
                "successfully set executable permissions on backend binary {}",
                binary_path.display()
            );
        }
    }
    Ok(())
}

pub fn get_shinkai_tools_binary_name() -> String {
    if cfg!(target_os = "windows") {
        "shinkai-tools-backend.exe".to_string()
    } else {
        "shinkai-tools-backend".to_string()
    }
}

pub fn get_source_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_path_buf()
}

pub fn get_target_path() -> PathBuf {
    let manifest_dir_string = env::var("CARGO_MANIFEST_DIR").unwrap();
    let build_type = env::var("PROFILE").unwrap();
    let path = Path::new(&manifest_dir_string)
        .join("target")
        .join(build_type);
    path
}

pub fn download_shinkai_tools_backend_binary(
    version: String,
    target_path: PathBuf,
) -> Result<(), std::io::Error> {
    let client = reqwest::blocking::Client::new();
    let arch = if cfg!(target_os = "linux") {
        "x86_64-unknown-linux-gnu"
    } else if cfg!(target_os = "macos") {
        "aarch64-apple-darwin"
    } else if cfg!(target_os = "windows") {
        "x86_64-pc-windows-msvc"
    } else {
        panic!("unsupported target OS");
    };
    let url = format!(
        "https://download.shinkai.com/shinkai-tools-backend/binaries/production/{}/{}.zip",
        arch, version
    );

    let mut response = client
        .get(&url)
        .send()
        .expect("failed to download backend binary");
    if !response.status().is_success() {
        panic!("failed to download backend binary: {}", response.status());
    }

    let mut file = fs::File::create(&target_path).expect("failed to create backend binary file");
    response
        .copy_to(&mut file)
        .expect("failed to write backend binary to file");
    file.flush().expect("failed to flush backend binary file");
    Ok(())
}

pub fn copy_assets(
    version: &str,
    source_path: Option<PathBuf>,
    target_path: Option<PathBuf>,
) -> Result<(), std::io::Error> {
    let resources_folder_name = "shinkai-tools-runner-resources";
    let source_path =
        source_path.unwrap_or_else(get_source_path).join(resources_folder_name);
    let target_path = target_path.unwrap_or_else(get_target_path).join(resources_folder_name);

    println!("resources path: {}", source_path.display());
    println!("target path: {}", target_path.display());

    let shinkai_tools_backend_binary_name = get_shinkai_tools_binary_name();
    let shinkai_tools_backend_source_path =
        source_path.join(shinkai_tools_backend_binary_name.clone());
    let shinkai_tools_backend_target_path =
        target_path.join(shinkai_tools_backend_binary_name.clone());
    println!(
        "shinkai-tools-backend source path: {}",
        shinkai_tools_backend_source_path.display()
    );
    println!(
        "shinkai-tools-backend target path: {}",
        shinkai_tools_backend_target_path.display()
    );
    fs::create_dir_all(&source_path).unwrap_or_else(|err| {
        panic!("failed to create resources directory: {}", err);
    });
    fs::create_dir_all(&target_path).unwrap_or_else(|err| {
        panic!("failed to create target directory: {}", err);
    });

    let zipped_file = source_path.join(format!("shinkai-tools-backend-{}.zip", version));
    if !zipped_file.exists() {
        download_shinkai_tools_backend_binary(version.to_string(), zipped_file.clone())?;
    }

    // Unzip the downloaded file
    let zip_file = std::fs::File::open(&zipped_file).expect("failed to read zipped binary");
    let mut archive = zip::ZipArchive::new(zip_file).expect("failed to open zip archive");
    archive
        .extract(&source_path)
        .expect("failed to extract zip archive");

    fs::copy(
        &shinkai_tools_backend_source_path,
        &shinkai_tools_backend_target_path,
    )
    .unwrap_or_else(|err| {
        panic!(
            "failed to copy downloaded backend binary to target path: {}",
            err
        );
    });
    println!(
        "downloaded and copied backend binary to target path {}",
        shinkai_tools_backend_target_path.display()
    );

    add_exec_permissions(&shinkai_tools_backend_target_path)?;
    Ok(())
}
