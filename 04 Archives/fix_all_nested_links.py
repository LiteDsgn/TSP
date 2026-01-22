import os
import re

vault_root = "/Users/henry/Library/Mobile Documents/iCloud~md~obsidian/Documents/TSP"

# Pattern 1: [[Prefix/[[InnerTarget|InnerAlias]]|OuterAlias]]
# Matches: [[03 Resources/Glossary/[[BRIA|BRIA]]|BRIA (Hebrew)]]
# Capture 1: Prefix (03 Resources/Glossary/)
# Capture 2: InnerTarget (BRIA)
# Capture 3: OuterAlias (BRIA (Hebrew))
pattern1 = re.compile(r"\[\[(.*?)\[\[(.*?)(?:\|.*?)?\]\]\|(.*?)\]\]")

# Pattern 2: [[Prefix/[[InnerTarget]]]]
# Matches: [[Folder/[[Note]]]]
pattern2 = re.compile(r"\[\[(.*?)\[\[(.*?)\]\]\]\]")

def fix_content(content):
    original = content
    
    # Fix Pattern 1
    # Replacement: [[PrefixInnerTarget|OuterAlias]]
    content = pattern1.sub(r"[[\1\2|\3]]", content)
    
    # Fix Pattern 2
    # Replacement: [[PrefixInnerTarget]]
    content = pattern2.sub(r"[[\1\2]]", content)
    
    return content, content != original

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content, changed = fix_content(content)
        
        if changed:
            print(f"Fixing nested links in: {file_path}")
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    for root, dirs, files in os.walk(vault_root):
        if '.git' in root:
            continue
        for file in files:
            if file.endswith(".md"):
                process_file(os.path.join(root, file))
