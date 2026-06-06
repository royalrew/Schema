import os
import re

backend_dir = r"c:/Users/royal/OneDrive/Skrivbord/Mitt foretag/Töreboda Schema/toreboda-schema/apps/api/app"
patterns = [
    r"\.group",
    r"Group\("
]

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
                for pattern in patterns:
                    matches = list(re.finditer(pattern, content))
                    if matches:
                        print(f"File: {os.path.relpath(path, backend_dir)}")
                        for m in matches:
                            start = max(0, m.start() - 40)
                            end = min(len(content), m.end() + 40)
                            snippet = content[start:end].replace("\n", " ")
                            print(f"  Match: ...{snippet}...")
