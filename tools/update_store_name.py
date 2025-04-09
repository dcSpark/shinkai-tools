import json
import os

def update_store_name(tool_dir):
    # Read metadata.json
    metadata_path = os.path.join(tool_dir, 'metadata.json')
    store_path = os.path.join(tool_dir, 'store.json')
    
    # Skip if either file doesn't exist
    if not (os.path.exists(metadata_path) and os.path.exists(store_path)):
        return False
    
    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        with open(store_path, 'r') as f:
            store = json.load(f)
        
        # Update the name field
        store['name'] = metadata['name']
        
        # Write back to store.json
        with open(store_path, 'w') as f:
            json.dump(store, f, indent=2)
        return True
    except Exception as e:
        print(f"Error processing {tool_dir}: {str(e)}")
        return False

def update_all_tools():
    tools_dir = 'tools'
    updated_count = 0
    
    # Get all directories in tools folder
    for item in os.listdir(tools_dir):
        full_path = os.path.join(tools_dir, item)
        # Skip non-directories and hidden directories
        if not os.path.isdir(full_path) or item.startswith('.'):
            continue
            
        if update_store_name(full_path):
            print(f"Updated store.json in {full_path}")
            updated_count += 1
    
    print(f"\nTotal tools updated: {updated_count}")

if __name__ == '__main__':
    update_all_tools() 