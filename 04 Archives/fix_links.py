
import re

file_path = "03 Resources/Theology/THEOLOGICAL GLOSSARY.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Pattern: [[Path/[[Target|Target]]|Display]]
# We want: [[Path/Target|Display]]

# Regex explanation:
# \[\[                      Literal [[
# (03 Resources/Glossary/)  Group 1: Path prefix
# \[\[                      Literal [[ inside
# (.*?)                     Group 2: The actual term (e.g. BRIA)
# \|                        Literal |
# .*?                       The repeated text we don't need
# \]\]                      Literal ]] closing the inner link
# \|                        Literal | separator for outer link
# (.*?)                     Group 3: The display text (e.g. BRIA (Hebrew))
# \]\]                      Literal ]] closing outer link

# Actually, the structure I see in the file is: 
# [[03 Resources/Glossary/[[BRIA|BRIA]]|BRIA (בְּרִיאָה)]]
# Let's target this specific mess.

def replacement(match):
    prefix = match.group(1)
    term = match.group(2)
    display = match.group(3)
    return f"[[{prefix}{term}|{display}]]"

# Regex: [[(prefix)(inner_link)|(display)]]
# inner_link is [[term|term]]

pattern = re.compile(r"\[\[(03 Resources/Glossary/)\[\[(.*?)\|.*?\]\]\|(.*?)\]\]")

new_content = pattern.sub(replacement, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Fixed nested links.")
