
import os
import re

# Source file path
source_file = "THEOLOGICAL GLOSSARY.md"
# Output directory
output_dir = "03 Resources/Glossary"

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Read the source file
with open(source_file, "r", encoding="utf-8") as f:
    content = f.read()

# Split the content into Introduction and Entries
# We look for the first occurrence of "### ADAM" to start the split, 
# but generally we look for "### [TERM]" pattern.
# Actually, the file has "## ALPHABETICAL ENTRIES" before the first term.

parts = content.split("## ALPHABETICAL ENTRIES")

intro_part = parts[0]
entries_part = parts[1] if len(parts) > 1 else ""

# Regex to find entries: ### TERM (HEBREW)
# We capture the term name and the content following it until the next ### or End of File
pattern = re.compile(r"###\s+(.*?)\s+\((.*?)\)(.*?)((?=###)|$)", re.DOTALL)

# Since the regex might be tricky with "###" separators, let's try a split approach on "### "
# But we need to keep the headers.

# Let's iterate through the entries part.
# We'll split by "### " and skip the first empty one if any.
raw_entries = re.split(r'\n### ', "\n" + entries_part)

links = []

for entry in raw_entries:
    if not entry.strip():
        continue
    
    # Extract Title (Term + Hebrew)
    # The first line is the title
    lines = entry.strip().split('\n', 1)
    title_line = lines[0].strip()
    
    # Check if this looks like a glossary term (has Hebrew or just CAPS)
    # The format is "TERM (HEBREW)" usually.
    # Example: "ADAM (אָדָם)"
    
    # We want the filename to be just "ADAM" usually, or "ADAM (אָדָם)"
    # Let's keep it clean: "ADAM"
    
    term_match = re.match(r"([A-Z\s'-]+)(?:\((.*?)\))?", title_line)
    
    if term_match:
        term_name = term_match.group(1).strip()
        hebrew = term_match.group(2) if term_match.group(2) else ""
        
        # File content
        body = lines[1] if len(lines) > 1 else ""
        
        # Construct the file content
        # We'll add the header back
        file_content = f"# {title_line}\n\n{body}"
        
        # Sanitize filename
        filename = term_name.replace("/", "-").replace(":", "") + ".md"
        file_path = os.path.join(output_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(file_content)
            
        links.append(f"- [[03 Resources/Glossary/{term_name}|{title_line}]]")
        print(f"Created: {filename}")

# Now recreate the main Glossary file
new_glossary_content = intro_part + "## ALPHABETICAL ENTRIES\n\n" + "\n".join(sorted(links))

with open("THEOLOGICAL GLOSSARY.md", "w", encoding="utf-8") as f:
    f.write(new_glossary_content)

print("Glossary refactoring complete.")
