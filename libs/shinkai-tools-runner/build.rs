use std::env;
use std::path::PathBuf;

#[path = "src/copy_assets.rs"]
mod copy_assets;

fn main() {
    println!("cargo:rerun-if-changed=copy_assets.rs");
    // Get profile (debug/release) from cargo
    let profile = env::var("PROFILE").unwrap();
    copy_assets::copy_assets(
        Some(PathBuf::from(".")),
        Some(PathBuf::from("../../target").join(&profile)),
    );
}
