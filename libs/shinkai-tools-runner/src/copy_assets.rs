use once_cell::sync::Lazy;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;

pub static DENO_VERSION: &str = "v2.1.1";
pub static UV_VERSION: &str = "v0.5.7";
static PROFILE: Lazy<String> =
    Lazy::new(|| std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string()));

static RESOURCES_FOLDER_NAME: &str = "shinkai-tools-runner-resources";

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
                "successfully set executable permissions on deno binary {}",
                binary_path.display()
            );
        }
    }
    Ok(())
}

pub fn deno_binary_name() -> String {
    if cfg!(target_os = "windows") {
        "deno.exe".to_string()
    } else {
        "deno".to_string()
    }
}

pub fn get_source_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_path_buf()
}

pub fn get_target_path() -> PathBuf {
    let manifest_dir_string = env::var("CARGO_MANIFEST_DIR").unwrap();
    let path = Path::new(&manifest_dir_string)
        .join("target")
        .join(PROFILE.as_str());
    path
}

pub fn download_deno_zip(version: String, target_path: PathBuf) -> Result<(), std::io::Error> {
    let arch = if cfg!(target_os = "linux") {
        "x86_64-unknown-linux-gnu"
    } else if cfg!(target_os = "macos") {
        "aarch64-apple-darwin"
    } else if cfg!(target_os = "windows") {
        "x86_64-pc-windows-msvc"
    } else {
        panic!("unsupported target OS");
    };

    let deno_binary_url = format!("https://dl.deno.land/release/{}/deno-{}.zip", version, arch);

    let client = reqwest::blocking::Client::new();

    let mut response = client
        .get(deno_binary_url)
        .send()
        .expect("failed to download deno binary");
    if !response.status().is_success() {
        panic!("failed to download deno binary: {}", response.status());
    }

    let mut file = fs::File::create(target_path).expect("failed to create deno zip file");
    response
        .copy_to(&mut file)
        .expect("failed to write deno zip file");
    file.flush().expect("failed to flush deno zip file");
    Ok(())
}

pub fn copy_assets(
    source_path: Option<PathBuf>,
    target_path: Option<PathBuf>,
) -> Result<(), std::io::Error> {
    copy_deno(DENO_VERSION, source_path.clone(), target_path.clone())?;
    copy_uv(UV_VERSION, source_path.clone(), target_path.clone())?;
    Ok(())
}

pub fn copy_deno(
    version: &str,
    source_path: Option<PathBuf>,
    target_path: Option<PathBuf>,
) -> Result<(), std::io::Error> {
    println!("using resources folder name: {}", RESOURCES_FOLDER_NAME);

    let source_path = source_path
        .unwrap_or_else(get_source_path)
        .join(RESOURCES_FOLDER_NAME);
    let target_path = target_path
        .unwrap_or_else(get_target_path)
        .join(RESOURCES_FOLDER_NAME);

    println!("resources path: {}", source_path.display());
    println!("target path: {}", target_path.display());

    let deno_binary_name = deno_binary_name();
    println!("using deno binary name: {}", deno_binary_name);

    let deno_binary_source_path = source_path.join(deno_binary_name.clone());
    let deno_binary_target_path = target_path.join(deno_binary_name.clone());
    println!("deno source path: {}", deno_binary_source_path.display());
    println!("deno target path: {}", deno_binary_target_path.display());

    println!("creating resources directory at: {}", source_path.display());
    fs::create_dir_all(&source_path).unwrap_or_else(|err| {
        panic!("failed to create resources directory: {}", err);
    });

    println!("creating target directory at: {}", target_path.display());
    fs::create_dir_all(&target_path).unwrap_or_else(|err| {
        panic!("failed to create target directory: {}", err);
    });

    let zipped_file = source_path.join(format!("deno-{}.zip", version));
    println!("zipped file path: {}", zipped_file.display());

    if !zipped_file.exists() {
        println!("zipped file does not exist, downloading...");
        download_deno_zip(version.to_string(), zipped_file.clone())?;
        println!("successfully downloaded deno zip file");
    } else {
        println!("zipped file already exists, skipping download");
    }

    // Unzip the downloaded file
    println!("opening zip file for extraction");
    let zip_file = std::fs::File::open(&zipped_file).expect("failed to read zipped binary");
    let mut archive = zip::ZipArchive::new(zip_file).expect("failed to open zip archive");
    println!("extracting zip archive to: {}", source_path.display());
    archive
        .extract(&source_path)
        .expect("failed to extract zip archive");
    println!("successfully extracted zip archive");

    println!(
        "copying deno binary from {} to {}",
        deno_binary_source_path.display(),
        deno_binary_target_path.display()
    );
    fs::copy(&deno_binary_source_path, &deno_binary_target_path).unwrap_or_else(|err| {
        panic!(
            "failed to copy downloaded deno binary to target path: {}",
            err
        );
    });
    println!(
        "successfully copied deno binary to target path: {}",
        deno_binary_target_path.display()
    );

    println!("adding executable permissions to deno binary");
    add_exec_permissions(&deno_binary_target_path)?;
    println!("successfully added executable permissions");

    Ok(())
}

pub fn copy_uv(
    version: &str,
    source_path: Option<PathBuf>,
    target_path: Option<PathBuf>,
) -> Result<(), std::io::Error> {
    let version = version.strip_prefix('v').unwrap_or(version);
    let source_path = source_path
        .unwrap_or_else(get_source_path)
        .join(RESOURCES_FOLDER_NAME);
    let target_path = target_path
        .unwrap_or_else(get_target_path)
        .join(RESOURCES_FOLDER_NAME);

    println!("resources path: {}", source_path.display());
    println!("target path: {}", target_path.display());

    println!("creating target directory at: {}", target_path.display());
    fs::create_dir_all(&target_path).unwrap_or_else(|err| {
        panic!("failed to create target directory: {}", err);
    });

    let uv_binary_source_path = if cfg!(windows) {
        source_path.join("uv.exe")
    } else {
        source_path.join("uv")
    };

    let uv_binary_target_path = if cfg!(windows) {
        target_path.join("uv.exe")
    } else {
        target_path.join("uv")
    };

    // Download UV binary if it doesn't exist
    if !uv_binary_source_path.exists() {
        println!("UV binary does not exist, downloading...");
        let url = if cfg!(windows) {
            format!(
                "https://github.com/astral-sh/uv/releases/download/{}/uv-x86_64-pc-windows-msvc.zip",
                version
            )
        } else if cfg!(target_os = "macos") {
            format!(
                "https://github.com/astral-sh/uv/releases/download/{}/uv-aarch64-apple-darwin.tar.gz",
                version
            )
        } else {
            format!(
                "https://github.com/astral-sh/uv/releases/download/{}/uv-x86_64-unknown-linux-gnu.tar.gz",
                version
            )
        };

        let zipped_file = source_path.join("uv.zip");
        println!("downloading UV archive to: {}", zipped_file.display());

        let mut response = reqwest::blocking::Client::new()
            .get(&url)
            .send()
            .unwrap_or_else(|err| panic!("failed to download UV archive: {}", err));

        let mut file = std::fs::File::create(&zipped_file)
            .unwrap_or_else(|err| panic!("failed to create UV archive file: {}", err));

        std::io::copy(&mut response, &mut file)
            .unwrap_or_else(|err| panic!("failed to write UV archive to file: {}", err));

        println!("successfully downloaded UV archive");

        // Unzip the downloaded file
        println!("opening zip file for extraction");
        let zip_file = std::fs::File::open(&zipped_file).expect("failed to read zipped binary");
        if cfg!(windows) {
            let mut archive = zip::ZipArchive::new(zip_file).expect("failed to open zip archive");
            println!("extracting zip archive to: {}", source_path.display());
            archive
                .extract(&source_path)
                .expect("failed to extract zip archive");
        } else {
            let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(zip_file));
            println!("extracting tar.gz archive to: {}", source_path.display());
            archive
                .unpack(&source_path)
                .expect("failed to extract tar.gz archive");
            // Move binary from extracted folder to source path
            if !cfg!(windows) {
                let extracted_folder = if cfg!(target_os = "macos") {
                    source_path.join("uv-aarch64-apple-darwin")
                } else {
                    source_path.join("uv-x86_64-unknown-linux-gnu") 
                };
                
                let extracted_binary = extracted_folder.join("uv");
                println!("moving UV binary from {} to {}", extracted_binary.display(), uv_binary_source_path.display());
                fs::rename(extracted_binary, &uv_binary_source_path)
                    .expect("failed to move UV binary from extracted folder");
                
                // Clean up extracted folder
                fs::remove_dir_all(extracted_folder)
                    .expect("failed to remove extracted folder");
            }
        }
        println!("successfully extracted zip archive");
    } else {
        println!("UV binary already exists, skipping download");
    }

    println!(
        "copying UV binary from {} to {}",
        uv_binary_source_path.display(),
        uv_binary_target_path.display()
    );
    fs::copy(&uv_binary_source_path, &uv_binary_target_path).unwrap_or_else(|err| {
        panic!(
            "failed to copy downloaded UV binary to target path: {}",
            err
        );
    });
    println!(
        "successfully copied UV binary to target path: {}",
        uv_binary_target_path.display()
    );

    if !cfg!(windows) {
        println!("adding executable permissions to UV binary");
        add_exec_permissions(&uv_binary_target_path)?;
        println!("successfully added executable permissions");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn test_copy_assets() {
        tokio::task::spawn_blocking(|| {
            println!("profile: {:?}", PROFILE);
            let source = PathBuf::from("./");
            println!("source path: {}", source.display());
            let destination = PathBuf::from("../../target").join(PROFILE.as_str());
            println!("destination path: {}", destination.display());
            copy_assets(Some(source), Some(destination)).unwrap()
        })
        .await
        .unwrap();
    }
}
