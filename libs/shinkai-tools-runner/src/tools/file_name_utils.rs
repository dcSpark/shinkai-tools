
pub fn sanitize_for_file_name(file_name: String) -> String {
    file_name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "")
}
