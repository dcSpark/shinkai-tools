use std::path::PathBuf;

pub trait PathBufExt {
    fn as_normalized_string(&self) -> String;
}

impl PathBufExt for PathBuf {
    fn as_normalized_string(&self) -> String {
        self.to_string_lossy()
            .replace("\\\\?\\", "")
            .replace("\\", "/")
    }
}
