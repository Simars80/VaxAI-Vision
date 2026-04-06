# -*- coding: utf-8 -*-
import os, subprocess

# U+2019 right single quotation mark in the folder name
repo = "/Users/Simars_1/Desktop/Mustapha\u2019s MacBook Pro/abdulhafeez/VaxAI Vision/VaxAI Vision Dev"

print("Repo exists:", os.path.isdir(repo))
print("Git dir exists:", os.path.isdir(os.path.join(repo, ".git")))

def run(cmd, **kw):
    r = subprocess.run(cmd, cwd=repo, capture_output=True, text=True, **kw)
    out = (r.stdout + r.stderr).strip()
    if out:
        print(out)
    return r.returncode

# Configure git identity
run(["git", "config", "user.email", "vaxai.vision@gmail.com"])
run(["git", "config", "user.name", "VaxAI Team"])

# Check status
print("--- STATUS ---")
run(["git", "status"])

# Stage the workflow file
print("--- ADDING ---")
run(["git", "add", ".github/workflows/deploy-pages.yml"])

# Commit
print("--- COMMITTING ---")
rc = run(["git", "commit", "-m", "ci: add GitHub Pages deployment workflow for React frontend\n\nDeploys frontend/dist to GitHub Pages on every push to main.\nCustom domain app.vaxaivision.com to be configured via CNAME."])
if rc == 1:
    print("Nothing to commit or already committed")

# Pull then push
print("--- PULLING ---")
run(["git", "pull", "--rebase", "origin", "main"])

print("--- PUSHING ---")
rc2 = run(["git", "push", "origin", "main"])
if rc2 == 0:
    print("PUSH_SUCCESS")
else:
    print("PUSH_FAILED")
