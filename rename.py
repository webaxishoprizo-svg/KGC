import os
import re

target_dirs = [
    r"c:\Users\mubas\KGC\Frontend",
    r"c:\Users\mubas\KGC\Backend"
]

replacements = [
    ("Tamil Nadu", "Karnataka"),
    ("Tamil nadu", "Karnataka"),
    ("tamil nadu", "karnataka"),
    ("Tamilnadu", "Karnataka"),
    ("tamilnadu", "karnataka"),
    ("TNGC", "KGC"),
    ("tngc", "kgc"),
    ("Tamil", "Kannada"),
    ("tamil", "kannada"),
    ("Chennai", "Bengaluru"),
    ("Coimbatore", "Mysuru"),
    ("Madurai", "Hubballi"),
    ("Trichy", "Mangaluru"),
    ("Salem", "Belagavi"),
    ('lang === "ta"', 'lang === "kn"'),
    ("lang === 'ta'", "lang === 'kn'"),
    ("lang: 'ta'", "lang: 'kn'"),
    ('lang: "ta"', 'lang: "kn"'),
    ('language: "ta"', 'language: "kn"'),
    ("language: 'ta'", "language: 'kn'"),
    ('"ta"', '"kn"'),
    ("'ta'", "'kn'"),
]

skip_extensions = {".png", ".jpg", ".jpeg", ".ico", ".svg", ".pyc", ".db", ".sqlite", ".sqlite3"}
skip_dirs = {"node_modules", ".git", ".venv", "__pycache__", "dist", "build"}

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return

    original_content = content
    for old, new in replacements:
        content = content.replace(old, new)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

def rename_and_process():
    # First, rename files
    for d in target_dirs:
        for root, dirs, files in os.walk(d):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for file in files:
                if "tngc" in file.lower() or "tamil" in file.lower():
                    old_path = os.path.join(root, file)
                    new_file = file.replace("tngc", "kgc").replace("TNGC", "KGC").replace("tamil", "kannada").replace("Tamil", "Kannada")
                    new_path = os.path.join(root, new_file)
                    os.rename(old_path, new_path)

    # Second, process contents
    for d in target_dirs:
        for root, dirs, files in os.walk(d):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in skip_extensions:
                    process_file(os.path.join(root, file))

if __name__ == "__main__":
    rename_and_process()
    print("Done")
