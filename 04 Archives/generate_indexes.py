
import os

# Configuration
vault_root = "."
folders_to_index = {
    "01 Projects/Website Articles": "Website Articles Index",
    "01 Projects/Social Media Threads": "Social Media Index",
    "01 Projects/Books": "Books Index",
    "02 Areas/Family": "Family Index",
    "03 Resources/People": "People Index",
    "03 Resources/Theology": "Theology Index"
}

def generate_indexes():
    for folder, index_name in folders_to_index.items():
        folder_path = os.path.join(vault_root, folder)
        if not os.path.exists(folder_path):
            continue
            
        # Get list of files
        files = [f for f in os.listdir(folder_path) if f.endswith(".md") and f != f"{index_name}.md"]
        files.sort()
        
        # Create Content
        content = f"# 📂 {index_name}\n\n"
        content += f"**Location:** `{folder}`\n\n"
        content += "---\n\n"
        
        if not files:
            content += "*No files found in this section yet.*\n"
        else:
            for file in files:
                # remove .md extension for link
                link_name = file.replace(".md", "")
                content += f"- [[{link_name}]]\n"
        
        content += "\n---\n"
        content += "[[Home Dashboard|🏠 Back to Dashboard]]"
        
        # Write file
        file_path = os.path.join(folder_path, f"{index_name}.md")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Created Index: {file_path}")

if __name__ == "__main__":
    generate_indexes()
