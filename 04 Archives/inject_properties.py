
import os
import re
import datetime

vault_root = "."
current_date = datetime.date.today().isoformat()

# Regex to find Hebrew characters
hebrew_pattern = re.compile(r"[\u0590-\u05FF]+")

def get_frontmatter(file_path, content, category):
    properties = {}
    tags = []
    
    # Default Properties
    properties["created"] = current_date
    properties["updated"] = current_date
    
    # Category Specifics
    if category == "glossary":
        properties["type"] = "concept"
        tags.extend(["glossary", "hebrew", "theology"])
        
        # Extract Hebrew for Alias
        # Usually in first line: # ADAM (אָדָם)
        first_line = content.split('\n')[0]
        hebrew_match = hebrew_pattern.search(first_line)
        if hebrew_match:
            properties["aliases"] = f"\n  - {hebrew_match.group(0)}"
            
    elif category == "articles":
        properties["type"] = "article"
        properties["status"] = "draft"
        tags.extend(["writing", "theology"])
        # Heuristic: Add 'identity' tag if in title
        if "Identity" in file_path or "IDENTITY" in file_path:
            tags.append("identity")
            
    elif category == "social":
        properties["type"] = "social"
        properties["platform"] = "twitter"
        tags.extend(["thread", "thoughts"])
        
    elif category == "books":
        properties["type"] = "manuscript"
        tags.extend(["book", "writing"])
        
    elif category == "people":
        properties["type"] = "person"
        tags.extend(["influence", "author"])
        
    elif category == "family":
        properties["type"] = "letter"
        tags.extend(["family", "personal"])
        
    elif category == "theology":
        properties["type"] = "resource"
        tags.extend(["theology", "concept"])
        
    # Format YAML
    yaml = "---\n"
    for key, value in properties.items():
        if key == "aliases":
            yaml += f"aliases:{value}\n"
        else:
            yaml += f"{key}: {value}\n"
    
    # Add Tags
    if tags:
        yaml += "tags:\n"
        for tag in tags:
            yaml += f"  - {tag}\n"
            
    yaml += "---\n\n"
    return yaml

def process_files():
    # Map folders to categories
    mappings = {
        "01 Projects/Website Articles": "articles",
        "01 Projects/Social Media Threads": "social",
        "01 Projects/Books": "books",
        "02 Areas/Family": "family",
        "03 Resources/Glossary": "glossary",
        "03 Resources/People": "people",
        "03 Resources/Theology": "theology"
    }

    for folder, category in mappings.items():
        folder_path = os.path.join(vault_root, folder)
        if not os.path.exists(folder_path):
            continue
            
        for filename in os.listdir(folder_path):
            if not filename.endswith(".md") or "Index" in filename:
                continue
                
            file_path = os.path.join(folder_path, filename)
            
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Skip if already has frontmatter
            if content.startswith("---"):
                continue
                
            # Generate Frontmatter
            frontmatter = get_frontmatter(file_path, content, category)
            
            # Write back
            new_content = frontmatter + content
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            
            print(f"Updated: {filename} [{category}]")

if __name__ == "__main__":
    process_files()
