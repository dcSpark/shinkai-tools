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
                    file_inbox: null,
                    oauth: null,
                    output_arg: {
                        json: ""
                    },
                    author: ($metadata[0].author // "Unknown"),
                    config: (
                        if ($metadata[0].configurations | type) == "object" and ($metadata[0].configurations.properties | type) == "object" then
                            ($metadata[0].configurations.properties | to_entries | map({
                                BasicConfig: {
                                    key_name: .key,
                                    description: (.value.description // ""),
                                    required: (if ($metadata[0].configurations.required | type) == "array" then .key as $k | $metadata[0].configurations.required | contains([$k]) else false end),
                                    key_value: null
                                }
                            }))
                        else
                            []
                        end
                    ),
                    description: ($metadata[0].description // "No description provided."),
                    input_args: ($metadata[0].parameters // []),
                    keywords: ($metadata[0].keywords // []),
                    name: ($metadata[0].name // "Unknown"),
                    result: ($metadata[0].result // {}),
                    sql_queries: ($metadata[0].sqlQueries // []),
                    sql_tables: ($metadata[0].sqlTables // []),
                    toolkit_name: ($metadata[0].id // "Unknown"),
                    tools: ($metadata[0].tools // []),
                    version: ($metadata[0].version // "1.0.0"),
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
                    file_inbox: null,
                    oauth: null,
                    output_arg: {
                        json: ""
                    },                    
                    author: ($metadata[0].author // "Unknown"),
                    config: (
                        if ($metadata[0].configurations | type) == "object" and ($metadata[0].configurations.properties | type) == "object" then
                            ($metadata[0].configurations.properties | to_entries | map({
                                BasicConfig: {
                                    key_name: .key,
                                    description: (.value.description // ""),
                                    required: (if ($metadata[0].configurations.required | type) == "array" then .key as $k | $metadata[0].configurations.required | contains([$k]) else false end),
                                    key_value: null
                                }
                            }))
                        else
                            []
                        end
                    ),
                    description: ($metadata[0].description // "No description provided."),
                    input_args: ($metadata[0].parameters // []),
                    keywords: ($metadata[0].keywords // []),
                    name: ($metadata[0].name // "Unknown"),
                    result: ($metadata[0].result // {}),
                    sql_queries: ($metadata[0].sqlQueries // []),
                    sql_tables: ($metadata[0].sqlTables // []),
                    toolkit_name: ($metadata[0].id // "Unknown"),
                    tools: ($metadata[0].tools // []),
                    version: ($metadata[0].version // "1.0.0"),                    
                    js_code: $code
                }, false],
                type: $tool_type
            }' > /tmp/request.json
            
            # Clean up intermediate files
            rm /tmp/tool_content.txt /tmp/metadata.json
        fi
        
        # Send to Shinkai node using the temporary file and capture response
        response=$(curl -s -w "\n%{http_code}" --location "${SHINKAI_NODE_ADDR}/v2/add_shinkai_tool" \
            --header "Authorization: Bearer ${BEARER_TOKEN}" \
            --header 'Content-Type: application/json' \
            --data @/tmp/request.json)
        
        http_code=$(echo "$response" | tail -n1)
        uploaded_tool=$(echo "$response" | head -n1)

        # Clean up request file
        rm /tmp/request.json

        if [ "$http_code" != "200" ]; then
            echo "Failed to upload tool to Shinkai node. HTTP status: $http_code"
            echo "Response: $uploaded_tool"
            continue
        fi

        tool_router_key=$(echo "$uploaded_tool" | jq -r '.message' | sed 's/.*key: //')
        tool_description=$(echo "$metadata_content" | jq -r '.description // "No description provided."')
        author=$(echo "$metadata_content" | jq -r '.author // "Unknown"')
        version=$(echo "$metadata_content" | jq -r '.version // "0.0.0"')
        keywords=$(echo "$metadata_content" | jq -r '.keywords // ["tool"]')

        # Request zip file from the node
        response=$(curl -s -w "\n%{http_code}" --location "${SHINKAI_NODE_ADDR}/v2/export_tool?tool_key_path=${tool_router_key}" \
            --header "Authorization: Bearer ${BEARER_TOKEN}" \
            --header 'Content-Type: application/json; charset=utf-8')

        http_code=$(echo "$response" | tail -n1)
        zip_content=$(echo "$response" | head -n1)

        if [ "$http_code" != "200" ]; then
            echo "Failed to export tool from Shinkai node. HTTP status: $http_code"
            echo "Response: $zip_content"
            continue
        fi

        echo "$zip_content" > packages/${tool_name}.zip

        # Generate a blake3 hash of the .zip file
        blake3_hash=$(b3sum packages/${tool_name}.zip | cut -d ' ' -f 1)

        # Check if a .default file exists for this tool
        has_default=false
        if [ -f "tools/${tool_name}/.default" ]; then
            has_default=true
        fi

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
           --arg has_default "$has_default" \
           --arg file "$DOWNLOAD_PREFIX/$tool_name.zip" \
            '. += [{default: $has_default, name: $tool_name, author: $author, keywords: $keywords, type: "Tool", tool_language: $tool_language, version: $version, description: $description, router_key: $tool_router_key, hash: $blake3_hash, file: $file}]' packages/directory.json > packages/directory.json.tmp
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

