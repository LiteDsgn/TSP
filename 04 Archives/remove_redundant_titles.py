import os
import re

vault_root = "/Users/henry/Library/Mobile Documents/iCloud~md~obsidian/Documents/TSP"

def clean_text(text):
    """Normalize text for comparison: remove all non-alphanumeric, lowercase."""
    # Keep only alphanumeric chars
    text = re.sub(r'[^a-zA-Z0-9]', '', text)
    return text.lower()

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    filename = os.path.basename(file_path)
    if not filename.endswith('.md'):
        return
    
    file_title = filename[:-3]
    clean_file_title = clean_text(file_title)

    new_lines = []
    title_removed = False
    
    # Determine if file has frontmatter
    has_frontmatter = False
    if lines and lines[0].strip() == "---":
        has_frontmatter = True
    
    in_frontmatter = has_frontmatter
    frontmatter_count = 0
    found_first_header = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Handle Frontmatter
        if in_frontmatter:
            new_lines.append(line)
            if stripped == "---":
                frontmatter_count += 1
                if frontmatter_count == 2:
                    in_frontmatter = False
            continue
        
        # In Content
        if not found_first_header and stripped.startswith('#'):
            # Check H1 candidates
            header_content = ""
            if stripped.startswith('# '):
                header_content = stripped[2:].strip()
            elif stripped.startswith('#') and not stripped.startswith('##'):
                header_content = stripped[1:].strip()
            else:
                # Not an H1 or is H2+, keep it
                new_lines.append(line)
                continue # If it's H2, we keep looking for H1? 
                # Usually H1 comes first. If we see H2 first, maybe there is no H1 title?
                # Let's assume if we hit ANY header, we stop looking for the title match 
                # unless we want to be very aggressive. 
                # Safest: if we hit a header that IS H1, check it. If H2, stop looking.
                
            if stripped.startswith('##'):
                 found_first_header = True
                 new_lines.append(line)
                 continue

            # It is an H1
            clean_header = clean_text(header_content)
            
            # Check for match (fuzzy)
            if clean_header == clean_file_title:
                print(f"Removing redundant title in {filename}")
                found_first_header = True
                title_removed = True
                continue
            else:
                # print(f"Header mismatch in {filename}: '{clean_header}' != '{clean_file_title}'")
                found_first_header = True
                new_lines.append(line)
        else:
            new_lines.append(line)

    if title_removed:
        final_lines = []
        fm_count = 0
        content_started = False
        
        # Re-process to clean up leading blank lines after frontmatter/start
        
        # Logic: 
        # If has_frontmatter: copy until 2nd ---. Then skip blanks until content.
        # If no frontmatter: skip blanks until content.
        
        in_fm_write = has_frontmatter
        fm_markers_seen = 0
        
        for line in new_lines:
            stripped = line.strip()
            
            if in_fm_write:
                final_lines.append(line)
                if stripped == "---":
                    fm_markers_seen += 1
                    if fm_markers_seen == 2:
                        in_fm_write = False
                continue
            
            # Content area
            if not content_started:
                if stripped == "":
                    continue
                else:
                    content_started = True
                    final_lines.append(line)
            else:
                final_lines.append(line)
                
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(final_lines)

if __name__ == "__main__":
    for root, dirs, files in os.walk(vault_root):
        if '.git' in root:
            continue
            
        for file in files:
            if file.endswith(".md"):
                process_file(os.path.join(root, file))
