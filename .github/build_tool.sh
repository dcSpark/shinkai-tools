#!/bin/bash

# Function to get tool type based on file extension
get_tool_type() {
    local file=$1
    if [[ $file == *.ts ]]; then
        echo "Deno"
    elif [[ $file == *.py ]]; then
        echo "Python"
    fi
}

# Create packages directory if it doesn't exist
mkdir -p packages

# Create empty directory.json
rm -f packages/directory.json
echo '[]' > packages/directory.json

# Process each tool directory
for tool_dir in tools/*/; do
    if [ -d "$tool_dir" ]; then
        # Get the tool name from directory
        tool_name=$(basename "$tool_dir")
        
        echo "Processing ${tool_name}..."
        
        # Check for either tool.ts or tool.py
        tool_file=""
        if [ -f "${tool_dir}tool.ts" ]; then
            tool_file="${tool_dir}tool.ts"
        elif [ -f "${tool_dir}tool.py" ]; then
            tool_file="${tool_dir}tool.py"
        fi

        # Check if required files exist
        if [ -z "$tool_file" ] || [ ! -f "${tool_dir}metadata.json" ]; then
            echo $tool_file $tool_dir
            echo "Error: Missing required files in ${tool_dir}"
            continue
        fi

        # Read metadata.json
        metadata_content=$(cat "${tool_dir}metadata.json")
        
        # Read tool content
        tool_content=$(cat "$tool_file")

        # Get tool type based on file extension
        tool_type=$(get_tool_type "$tool_file")

        # Create a job
        job_response=$(curl -s --location "${SHINKAI_NODE_ADDR}/v2/create_job" \
        --header 'Content-Type: application/json' \
        --header "Authorization: Bearer ${BEARER_TOKEN}" \
        --data '{
            "llm_provider": "",
            "job_creation_info": {
            "scope": {
                "vector_fs_items": [],
                "vector_fs_folders": [],
                "local_vrpack": [],
                "local_vrkai": [],
                "network_folders": []
            },
            "associated_ui": "Playground",
            "is_hidden": true
            }
        }')

        job_id=$(echo "$job_response" | jq -r '.job_id')

        if [ "$tool_type" = "Python" ]; then
            request_data=$(jq -n \
                --argjson metadata "$metadata_content" \
                --arg code "$tool_content" \
                --arg job_id "$job_id" \
                '{
                    metadata: $metadata,
                    code: $code,
                    language: "PYTHON",
                    job_id: $job_id
                }')
        else
            request_data=$(jq -n \
                --argjson metadata "$metadata_content" \
                --arg code "$tool_content" \
                --arg job_id "$job_id" \
                '{
                    metadata: $metadata,
                    code: $code,
                    language: "TYPESCRIPT",
                    job_id: $job_id
                }')
        fi

        # Upload the tool to the node.
        random_id=$(date +%s)
        uploaded_tool=$(curl -s --location "${SHINKAI_NODE_ADDR}/v2/set_playground_tool" \
            --header "Authorization: Bearer ${BEARER_TOKEN}" \
            --header 'Content-Type: application/json; charset=utf-8' \
            --header "x-shinkai-app-id: app-id-${random_id}" \
            --header "x-shinkai-tool-id: task-id-${random_id}" \
            --data "$request_data")

        tool_router_key=$(echo "$uploaded_tool" | jq -r '.metadata.tool_router_key')
        tool_description=$(echo "$uploaded_tool" | jq -r '.metadata.metadata.description')
        author=$(echo "$uploaded_tool" | jq -r '.metadata.metadata.author')
        version=$(echo "$uploaded_tool" | jq -r '.metadata.metadata.version')

        # Request zip file from the node.
        curl -s --location "${SHINKAI_NODE_ADDR}/v2/export_tool?tool_key_path=${tool_router_key}" \
            --header "Authorization: Bearer ${BEARER_TOKEN}" \
            --header 'Content-Type: application/json; charset=utf-8' > packages/${tool_name}.zip

        # Generate a blake3 hash of the .zip file
        blake3_hash=$(b3sum packages/${tool_name}.zip | cut -d ' ' -f 1)

        # Add tool to directory.json
        # Create temporary file with updated content
        jq --arg tool_name "$tool_name" --arg author "$author" --arg version "$version" --arg tool_router_key "$tool_router_key" --arg description "$tool_description" --arg blake3_hash "$blake3_hash" --arg file "$DOWNLOAD_PREFIX/$tool_name.zip" \
            '. += [{name: $tool_name, author: $author, version: $version, description: $description, router_key: $tool_router_key, hash: $blake3_hash, file: $file}]' packages/directory.json > packages/directory.json.tmp
        # Replace original file with temporary file
        mv packages/directory.json.tmp packages/directory.json
    fi
done