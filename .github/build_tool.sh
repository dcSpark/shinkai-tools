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

# Process tools directory
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
        
        # Build and send tool JSON to node
        if [ "$tool_type" = "Python" ]; then
            # Create temporary files for large content
            echo "$tool_content" > /tmp/tool_content.txt
            echo "$metadata_content" > /tmp/metadata.json
            
            jq -n \
            --slurpfile metadata /tmp/metadata.json \
            --rawfile code /tmp/tool_content.txt \
            --arg tool_type "$tool_type" \
            '{
                content: [{
                    activated: false,
                    assets: null,
                    author: ($metadata[0].author // "Unknown"),
                    config: [],
                    description: ($metadata[0].description // "No description provided."),
                    file_inbox: null,
                    input_args: ($metadata[0].parameters // []),
                    keywords: ($metadata[0].keywords // []),
                    name: ($metadata[0].name // "Unknown"),
                    oauth: null,
                    output_arg: {
                        json: ""
                    },
                    result: ($metadata[0].result // {}),
                    sql_queries: [],
                    sql_tables: [],
                    toolkit_name: ($metadata[0].id // "Unknown"),
                    tools: [],
                    py_code: $code
                }, false],
                type: $tool_type
            }' > /tmp/request.json
            
            # Clean up intermediate files
            rm /tmp/tool_content.txt /tmp/metadata.json
        else
            # Create temporary files for large content
            echo "$tool_content" > /tmp/tool_content.txt
            echo "$metadata_content" > /tmp/metadata.json
            
            jq -n \
            --slurpfile metadata /tmp/metadata.json \
            --rawfile code /tmp/tool_content.txt \
            --arg tool_type "$tool_type" \
            '{
                content: [{
                    activated: false,
                    assets: null,
                    author: ($metadata[0].author // "Unknown"),
                    config: [],
                    description: ($metadata[0].description // "No description provided."),
                    file_inbox: null,
                    input_args: ($metadata[0].parameters // []),
                    keywords: ($metadata[0].keywords // []),
                    name: ($metadata[0].name // "Unknown"),
                    oauth: null,
                    output_arg: {
                        json: ""
                    },
                    result: ($metadata[0].result // {}),
                    sql_queries: [],
                    sql_tables: [],
                    toolkit_name: ($metadata[0].id // "Unknown"),
                    tools: [],
                    js_code: $code
                }, false],
                type: $tool_type
            }' > /tmp/request.json
            
            # Clean up intermediate files
            rm /tmp/tool_content.txt /tmp/metadata.json
        fi
        
        # Send to Shinkai node using the temporary file and capture response
        uploaded_tool=$(curl -s --location "${SHINKAI_NODE_ADDR}/v2/add_shinkai_tool" \
            --header "Authorization: Bearer ${BEARER_TOKEN}" \
            --header 'Content-Type: application/json' \
            --data @/tmp/request.json)

        # Clean up request file
        rm /tmp/request.json

        tool_router_key=$(echo "$uploaded_tool" | jq -r '.message' | sed 's/.*key: //')
        tool_description=$(echo "$metadata_content" | jq -r '.description // "No description provided."')
        author=$(echo "$metadata_content" | jq -r '.author // "Unknown"')
        version=$(echo "$metadata_content" | jq -r '.version // "0.0.0"')
        keywords=$(echo "$metadata_content" | jq -r '.keywords // ["tool"]')

        # Request zip file from the node.
        curl -s --location "${SHINKAI_NODE_ADDR}/v2/export_tool?tool_key_path=${tool_router_key}" \
            --header "Authorization: Bearer ${BEARER_TOKEN}" \
            --header 'Content-Type: application/json; charset=utf-8' > packages/${tool_name}.zip

        # Generate a blake3 hash of the .zip file
        blake3_hash=$(b3sum packages/${tool_name}.zip | cut -d ' ' -f 1)

        # Add tool to directory.json
        # Create temporary file with updated content
        jq --arg tool_name "$tool_name" \
           --arg author "$author" \
           --argjson keywords "$keywords" \
           --arg tool_language "$tool_type" \
           --arg version "$version" \
           --arg tool_router_key "$tool_router_key" \
           --arg description "$tool_description" \
           --arg blake3_hash "$blake3_hash" \
           --arg file "$DOWNLOAD_PREFIX/$tool_name.zip" \
            '. += [{name: $tool_name, author: $author, keywords: $keywords, type: "Tool", tool_language: $tool_language, version: $version, description: $description, router_key: $tool_router_key, hash: $blake3_hash, file: $file}]' packages/directory.json > packages/directory.json.tmp
        # Replace original file with temporary file
        mv packages/directory.json.tmp packages/directory.json
    fi


done

# Process agents directory
for agent_file in agents/*.json; do
    if [ -f "$agent_file" ]; then
        echo "Processing agent ${agent_file}..."
        
        # Read agent JSON
        agent_content=$(cat "$agent_file")
        
        # Extract values from agent JSON
        agent_id=$(echo "$agent_content" | jq -r '.agent_id')
        agent_name=$(echo "$agent_content" | jq -r '.name')
        agent_description=$(echo "$agent_content" | jq -r '.ui_description')
        agent_author=$(echo "$agent_content" | jq -r '.author // "Unknown"')
        agent_version=$(echo "$agent_content" | jq -r '.version // "0.0.0"')
        agent_keywords=$(echo "$agent_content" | jq '.keywords // ["agent"]')

        # Create zip file
        zip -j "packages/${agent_id}.zip" "$agent_file"

        # Generate blake3 hash of the zip file
        blake3_hash=$(b3sum "packages/${agent_id}.zip" | cut -d ' ' -f 1)

        # Add agent to directory.json
        jq --arg name "$agent_name" \
           --arg author "$agent_author" \
           --argjson keywords "$agent_keywords" \
           --arg version "$agent_version" \
           --arg description "$agent_description" \
           --arg hash "$blake3_hash" \
           --arg file "$DOWNLOAD_PREFIX/${agent_id}.zip" \
           --arg agent_id "$agent_id" \
           '. += [{
                name: $name,
                author: $author,
                keywords: $keywords,
                type: "Agent",
                version: $version,
                description: $description,
                hash: $hash,
                file: $file,
                agent_id: $agent_id
            }]' packages/directory.json > packages/directory.json.tmp
        mv packages/directory.json.tmp packages/directory.json
    fi
done

# Process crons directory
for cron_file in crons/*.json; do
    if [ -f "$cron_file" ]; then
        echo "Processing cron ${cron_file}..."
        
        # Read cron JSON
        cron_content=$(cat "$cron_file")
        
        # Extract values from cron JSON
        cron_id=$(basename "$cron_file" .json)
        cron_name=$(echo "$cron_content" | jq -r '.name')
        cron_description=$(echo "$cron_content" | jq -r '.description')
        cron_author=$(echo "$cron_content" | jq -r '.author // "Unknown"')
        cron_version=$(echo "$cron_content" | jq -r '.version // "0.0.0"')
        cron_keywords=$(echo "$cron_content" | jq '.keywords // ["cron"]')

        # Create zip file
        zip -j "packages/${cron_id}.zip" "$cron_file"

        # Generate blake3 hash of the zip file
        blake3_hash=$(b3sum "packages/${cron_id}.zip" | cut -d ' ' -f 1)

        # Add cron to directory.json
        jq --arg name "$cron_name" \
           --arg author "$cron_author" \
           --argjson keywords "$cron_keywords" \
           --arg version "$cron_version" \
           --arg description "$cron_description" \
           --arg hash "$blake3_hash" \
           --arg file "$DOWNLOAD_PREFIX/${cron_id}.zip" \
           '. += [{
                name: $name,
                author: $author,
                keywords: $keywords,
                type: "Scheduled Task",
                version: $version,
                description: $description,
                hash: $hash,
                file: $file,
            }]' packages/directory.json > packages/directory.json.tmp
        mv packages/directory.json.tmp packages/directory.json
    fi
done

