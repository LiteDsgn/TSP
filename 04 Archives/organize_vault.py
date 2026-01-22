
import os
import re
import shutil

# Configuration
vault_root = "."
folders = {
    "articles": "01 Projects/Website Articles",
    "social": "01 Projects/Social Media Threads",
    "books": "01 Projects/Books",
    "theology": "03 Resources/Theology",
    "people": "03 Resources/People",
    "archive": "04 Archives",
    "glossary": "03 Resources/Glossary"
}

# Keywords for categorization
rules = [
    # People
    (r"(Andre Rabe|Francois Du Toit|Nathaniel Bassey|Pastor Femi|Mario)", "people"),
    
    # Social Media / Informal
    (r"(Twitter|angered critics|preachers|Telegraphic reading|Untitled|Evernote)", "social"), # Untitled usually drafts
    
    # Theology Concepts
    (r"(Dictionary|Glossary|Typology|Perspective|Connection|Theory|Equation|Schematics|Logic|Paradox|Truths|Dichotomy|Manual)", "theology"),
    
    # Articles (Long titles, "THE ...")
    (r"(THE |The |A Manifesto|An Awakening|How |Why |What |Where |When |Who |Title|Design is|Faith|God|Salvation|Redemption|Covenant|Blood|Flesh|Spirit|Christ|Son)", "articles")
]

# Glossary terms to link
glossary_terms = []
glossary_path = folders["glossary"]
if os.path.exists(glossary_path):
    for f in os.listdir(glossary_path):
        if f.endswith(".md"):
            glossary_terms.append(f.replace(".md", ""))

# Sort Files
def sort_files():
    for filename in os.listdir(vault_root):
        if not filename.endswith(".md"):
            continue
        
        # Skip Dashboard and specific system files
        if "Dashboard" in filename or "refactor" in filename or "organize" in filename:
            continue
            
        file_path = os.path.join(vault_root, filename)
        
        # Determine destination
        destination = None
        
        # Check rules
        for pattern, category in rules:
            if re.search(pattern, filename, re.IGNORECASE):
                destination = folders[category]
                break
        
        # Fallback for "Untitled" or leftovers -> Archive/To Sort (actually social/drafts for Untitled)
        if not destination:
            if "Untitled" in filename:
                destination = folders["archive"]
            else:
                # Default to theology resources if it looks like a note, or articles if it looks like a title
                # Let's put remaining in "04 Archives/To Sort" to be safe and clean the root
                destination = os.path.join(folders["archive"], "To Sort")
        
        # Move file
        if destination:
            os.makedirs(destination, exist_ok=True)
            shutil.move(file_path, os.path.join(destination, filename))
            print(f"Moved: {filename} -> {destination}")

# Link Injection
def inject_links():
    # We walk through all MD files in the vault (excluding the glossary itself to avoid self-loops if not careful)
    for root, dirs, files in os.walk(vault_root):
        if "03 Resources/Glossary" in root: # Don't link inside the glossary definitions themselves (optional choice)
             continue
             
        for filename in files:
            if not filename.endswith(".md"):
                continue
                
            file_path = os.path.join(root, filename)
            
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            original_content = content
            
            # Simple Link Injection: Find capitalized glossary terms and link them
            # We sort terms by length (descending) to match "First Adam" before "Adam" if we had such terms
            sorted_terms = sorted(glossary_terms, key=len, reverse=True)
            
            for term in sorted_terms:
                if len(term) < 3: continue # Skip short terms like "Ra" to avoid false positives in words like "Race"
                
                # Regex to match whole word, case insensitive, but not already linked
                # We look for " Term " that is NOT surrounded by [[ ]]
                # This is a basic implementation.
                
                # Logic: Replace first occurrence only to avoid spam
                # Look for word boundary \b
                pattern = re.compile(r'(?<!\[\[)\b' + re.escape(term) + r'\b(?!\]\])', re.IGNORECASE)
                
                # We only replace the FIRST occurrence
                match = pattern.search(content)
                if match:
                    # We found a match, let's link it.
                    # We preserve the original casing of the match
                    found_text = match.group(0)
                    replacement = f"[[{term}|{found_text}]]"
                    
                    # Replace only the first count
                    content = pattern.sub(replacement, content, count=1)
            
            if content != original_content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Linked: {filename}")

if __name__ == "__main__":
    sort_files()
    inject_links()
