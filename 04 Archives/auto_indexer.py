import os
import time
import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configuration
vault_root = "/Users/henry/Library/Mobile Documents/iCloud~md~obsidian/Documents/TSP"

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

# Map folders to their specific templates
folder_templates = {
    "01 Projects/Website Articles": "Templates/New Website Article.md",
    "01 Projects/Social Media Threads": "Templates/New Social Thread.md",
    "01 Projects/Books": "Templates/New Book Chapter.md",
    "03 Resources/People": "Templates/New Person.md",
    "03 Resources/Theology": "Templates/New Theology Note.md",
    "03 Resources/Glossary": "Templates/New Hebrew Word.md"
}

class IndexHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(".md"):
            print(f"File created: {event.src_path}")
            
            # 1. Apply Template (if file is empty)
            self.apply_template_if_empty(event.src_path)
            
            # 2. Update Index
            self.update_indexes(event.src_path)

    def on_deleted(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(".md"):
            print(f"File deleted: {event.src_path}")
            self.update_indexes(event.src_path)

    def on_moved(self, event):
        if event.is_directory:
            return
        if event.dest_path.endswith(".md"):
            print(f"File moved: {event.src_path} -> {event.dest_path}")
            self.update_indexes(event.src_path)
            self.update_indexes(event.dest_path)

    def apply_template_if_empty(self, file_path):
        """Checks if file is empty and applies the correct template."""
        # Wait briefly for file system to settle
        time.sleep(0.5)
        
        try:
            # Check if file is effectively empty (0 bytes or just whitespace)
            if os.path.getsize(file_path) > 10: 
                return # File already has content, don't overwrite
                
            # Determine which folder this file is in
            file_dir = os.path.dirname(file_path)
            rel_dir = os.path.relpath(file_dir, vault_root)
            
            # Check if we have a template for this folder
            template_path_rel = folder_templates.get(rel_dir)
            if not template_path_rel:
                return # No template assigned for this folder
                
            template_full_path = os.path.join(vault_root, template_path_rel)
            if not os.path.exists(template_full_path):
                print(f"Template not found: {template_full_path}")
                return
                
            # Read template
            with open(template_full_path, 'r', encoding='utf-8') as t:
                template_content = t.read()
                
            # Dynamic Replacements
            # {{date}} -> YYYY-MM-DD
            # {{title}} -> Filename without extension
            current_date = datetime.datetime.now().strftime("%Y-%m-%d")
            file_title = os.path.splitext(os.path.basename(file_path))[0]
            
            final_content = template_content.replace("{{date}}", current_date)
            final_content = final_content.replace("{{title}}", file_title)
            
            # Write to new file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(final_content)
                
            print(f"Applied template '{template_path_rel}' to '{os.path.basename(file_path)}'")
            
        except Exception as e:
            print(f"Error applying template: {e}")

    def update_indexes(self, changed_path):
        # Determine which folder was affected
        changed_dir = os.path.dirname(changed_path)
        rel_dir = os.path.relpath(changed_dir, vault_root)
        
        # Check if this folder is one we track
        index_name = folders_to_index.get(rel_dir)
        if not index_name:
            return

        # Wait a moment to ensure file system is settled
        time.sleep(0.5)
        
        self.regenerate_index(rel_dir, index_name)

    def regenerate_index(self, folder_rel, index_name):
        folder_path = os.path.join(vault_root, folder_rel)
        if not os.path.exists(folder_path):
            return

        # Get list of files
        try:
            files = [f for f in os.listdir(folder_path) if f.endswith(".md") and f != f"{index_name}.md"]
            files.sort()
        except Exception as e:
            print(f"Error reading directory {folder_path}: {e}")
            return

        # Create Content
        content = f"# 📂 {index_name}\n\n"
        content += f"**Location:** `{folder_rel}`\n\n"
        content += "---\n\n"
        
        if not files:
            content += "*No files found in this section yet.*\n"
        else:
            for file in files:
                link_name = file.replace(".md", "")
                content += f"- [[{link_name}]]\n"
        
        content += "\n---\n"
        content += "[[Home Dashboard|🏠 Back to Dashboard]]"
        
        # Write file
        index_file_path = os.path.join(folder_path, f"{index_name}.md")
        try:
            with open(index_file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Updated Index: {index_file_path}")
        except Exception as e:
            print(f"Error writing index {index_file_path}: {e}")

if __name__ == "__main__":
    event_handler = IndexHandler()
    observer = Observer()
    observer.schedule(event_handler, vault_root, recursive=True)
    observer.start()
    print(f"Watcher started. Monitoring {vault_root}...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
