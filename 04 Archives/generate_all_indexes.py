
import os

# Configuration
vault_root = "."
folders_to_index = {
    "01 Projects/Website Articles": "Website Articles Index",
    "01 Projects/Social Media Threads": "Social Media Index",
    "01 Projects/Books": "Books Index",
    "02 Areas/Family": "Family Index",
    "02 Areas/Ministry": "Ministry Index",
    "02 Areas/Admin": "Admin Index",
    "03 Resources/People": "People Index",
    "03 Resources/Theology": "Theology Index",
    "03 Resources/Glossary": "Hebrew Word Studies Index",
    "04 Archives/To Sort": "To Sort Index",
    "04 Archives/Evernote Import": "Evernote Archive Index"
}

def generate_indexes():
    for folder, index_name in folders_to_index.items():
        folder_path = os.path.join(vault_root, folder)
        
        # Ensure directory exists even if empty
        os.makedirs(folder_path, exist_ok=True)
            
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
