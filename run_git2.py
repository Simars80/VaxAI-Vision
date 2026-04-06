# -*- coding: utf-8 -*-
"""
Commits all untracked/modified files in the VaxAI Vision Dev repo.
Uses Unicode right single quote U+2019 in folder path.
"""
import os, subprocess

# U+2019 right single quotation mark
repo = "/Users/Simars_1/Desktop/Mustapha\u2019s MacBook Pro/abdulhafeez/VaxAI Vision/VaxAI Vision Dev"

def run(cmd, check=False):
    r = subprocess.run(cmd, cwd=repo, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if out:
        print(out)
    return r.returncode

# Configure identity
run(["git", "config", "user.email", "vaxai.vision@gmail.com"])
run(["git", "config", "user.name", "VaxAI Team"])

# Show status
print("=== CURRENT STATUS ===")
run(["git", "status", "--short"])

# Stage everything (excluding .DS_Store and .env files)
print("\n=== ADDING FILES ===")
run(["git", "add", "--all"])

# Unstage sensitive files
run(["git", "reset", "HEAD", "--", ".DS_Store", "backend/.DS_Store"])

# Show what will be committed
print("\n=== STAGED ===")
run(["git", "status", "--short"])

# Commit
print("\n=== COMMITTING ===")
rc = run(["git", "commit", "-m",
    "feat: integrate all platform components\n\n"
    "- Add backend Dockerfile, requirements, .env example\n"
    "- Add frontend Dockerfile, nginx config, .env example\n"
    "- Add all frontend source files (App, pages, components, store, api)\n"
    "- Add infrastructure .env example and .gitignore\n"
    "- Add DEV_ENVIRONMENT guide\n"
    "- Rename duplicate files to canonical names\n"
    "- Clean up ' 2' suffixed duplicates"
])
print(f"Commit exit code: {rc}")

# Pull then push
print("\n=== PULLING ===")
run(["git", "pull", "--rebase", "origin", "main"])

print("\n=== PUSHING ===")
rc2 = run(["git", "push", "origin", "main"])
if rc2 == 0:
    print("\nPUSH_SUCCESS")
else:
    print(f"\nPUSH_FAILED (rc={rc2})")
