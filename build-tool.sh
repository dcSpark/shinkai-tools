#!/bin/bash

# Function to convert directory name to toolkit name
convert_to_toolkit_name() {
    local dir_name=$1
    echo "${dir_name}" | tr '-' '_' | tr '.' '_'
}

# Function to get tool type based on file extension
get_tool_type() {
    local file=$1
    if [[ $file == *.ts ]]; then
        echo "Deno"
    elif [[ $file == *.py ]]; then
        echo "Python"
    fi
}

# Process each tool directory
echo "Processing tools..."
for tool_dir in tools/*/; do
    if [ -d "$tool_dir" ]; then
        # Get the tool name from directory
        tool_name=$(basename "$tool_dir")
        
        echo "Processing ${tool_name}"
        
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

        # Create packages directory if it doesn't exist
        mkdir -p "packages/${tool_name}"

        # Read metadata.json
        metadata_content=$(cat "${tool_dir}metadata.json")
        
        # Read tool content
        tool_content=$(cat "$tool_file")

        # Get tool type based on file extension
        tool_type=$(get_tool_type "$tool_file")

        # Convert directory name to toolkit name
        toolkit_name=$(convert_to_toolkit_name "$tool_name")

        # Create tool.json content
        # Set the code key based on tool type
        code_key="js_code"
        if [ "$tool_type" = "Python" ]; then
            code_key="py_code"
        fi

        jq -n \
            --arg type "$tool_type" \
            --arg toolkit_name "${toolkit_name}" \
            --arg tool_content "$tool_content" \
            --arg code_key "$code_key" \
            --argjson metadata "$metadata_content" \
            '{
            type: $type,
            content: [
                {
                toolkit_name: $toolkit_name,
                name: $metadata.name,
                author: $metadata.author,
                ($code_key): $tool_content,
                tools: $metadata.tools,
                config: $metadata.configurations,
                description: $metadata.description,
                keywords: $metadata.keywords,
                input_args: $metadata.parameters,
                output_arg: {json: ""},
                activated: false,
                embedding: null,
                result: $metadata.result,
                sql_tables: $metadata.sqlTables,
                sql_queries: $metadata.sqlQueries,
                file_inbox: null,
                oauth: $metadata.oauth
                },
                false
            ]
            }' > "packages/${tool_name}/tool.json"

        echo "Generated tool.json for ${tool_name}"

        # Create zip file
        cd "packages/${tool_name}"
        zip "${toolkit_name}.zip" tool.json
        cd ../..
        echo "Created ${toolkit_name}.zip"

        # Upload to Shinkai node
        echo Uploading to Shinkai node...

        # Create a job
        job_response=$(curl --location 'http://127.0.0.1:9550/v2/create_job' \
        --header 'Content-Type: application/json' \
        --header 'Authorization: Bearer debug' \
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

        echo Getting job_id...
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
        curl --location 'http://127.0.0.1:9550/v2/set_playground_tool' \
            --header 'Authorization: Bearer debug' \
            --header 'Content-Type: application/json; charset=utf-8' \
            --data "$request_data"
    fi
done