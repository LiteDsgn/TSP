
import os
import re

vault_root = "."
links = {} # File -> [Outgoing Links]
backlinks = {} # File -> [Incoming Links]
all_files = set()

# Initialize
for root, dirs, files in os.walk(vault_root):
    if "04 Archives" in root: continue # Skip archives for graph analysis
    for f in files:
        if f.endswith(".md"):
            path = os.path.join(root, f)
            name = f.replace(".md", "")
            all_files.add(name)
            if name not in links: links[name] = []
            if name not in backlinks: backlinks[name] = []

# Scan
for root, dirs, files in os.walk(vault_root):
    if "04 Archives" in root: continue
    for f in files:
        if f.endswith(".md"):
            name = f.replace(".md", "")
            path = os.path.join(root, f)
            
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
                
            # Find all [[links]]
            found = re.findall(r"\[\[(.*?)(?:\|.*?)?\]\]", content)
            
            for link in found:
                # Handle path/to/Note links
                clean_link = link.split("/")[-1]
                if clean_link in all_files:
                    links[name].append(clean_link)
                    backlinks[clean_link].append(name)

# Analyze
orphans = []
hubs = []

for f in all_files:
    incoming = len(backlinks.get(f, []))
    outgoing = len(links.get(f, []))
    
    if incoming == 0 and outgoing == 0:
        orphans.append(f)
    
    if incoming > 5:
        hubs.append((f, incoming))

hubs.sort(key=lambda x: x[1], reverse=True)

print(f"Total Active Files: {len(all_files)}")
print(f"Orphans (No connections): {len(orphans)}")
print(f"Top Hubs (Most linked-to): {hubs[:10]}")
print(f"Orphan List: {orphans[:10]}")
