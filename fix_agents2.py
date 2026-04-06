# -*- coding: utf-8 -*-
import os

# U+2019 right single quotation mark - this is the actual character in the folder name
CORRECT_REPO = "/Users/Simars_1/Desktop/Mustapha\u2019s MacBook Pro/abdulhafeez/VaxAI Vision/VaxAI Vision Dev"
REPO_URL = "https://github.com/Simars80/VaxAI-Vision.git"
COMPANY_ID = "c5a5fd01-9b28-4763-b20f-ef97ac7d6a7f"
BASE = f"/Users/Simars_1/.paperclip/instances/default/companies/{COMPANY_ID}/agents"

agents = [
    ("f26797a1-d1d7-4211-9639-19c1baf68ba9", "Backend Engineer",
     "backend/ (FastAPI app, REST APIs, HIPAA middleware, FHIR connector, Celery workers, PostgreSQL models)"),
    ("d55ececf-cb0e-4ed9-9009-b426d31b8c6f", "DevOps Engineer",
     "infrastructure/ and .github/ (Terraform, Helm, Docker Compose, GitHub Actions CI/CD, Flyway migrations)"),
    ("66830199-97c8-4be2-bdf8-b485386423f4", "Full-Stack Engineer",
     "frontend/ (React/TypeScript pages, components, Vite, Tailwind, Nginx)"),
    ("ab268e2d-1b77-4b14-896a-2cc9f1dbf7f3", "ML Engineer",
     "backend/app/ml/ (forecasting models, feature engineering, training pipelines, scikit-learn, PyTorch)"),
]

for agent_id, name, owns in agents:
    instr_dir = os.path.join(BASE, agent_id, "instructions")
    os.makedirs(instr_dir, exist_ok=True)
    lines = [
        "You are an agent at VaxAI Vision (Paperclip company).",
        "",
        "## Workspace",
        f"Local repo: {CORRECT_REPO}",
        f"GitHub remote: {REPO_URL}",
        "Branch: main",
        "",
        "## Non-Negotiable Rules",
        f'- ALWAYS start every session by changing to the repo: cd "{CORRECT_REPO}"',
        "- Commit and push ALL completed work: git push origin main",
        "- Git identity: user.email=vaxai.vision@gmail.com, user.name=VaxAI Team",
        "- Keep work moving. Update your ticket with a comment after each action.",
        "- If blocked, assign the ticket to CTO with a comment explaining the blocker.",
        "",
        f"## Your Role: {name}",
        f"You own: {owns}",
        "Check out assigned issues, implement the required code, test it, commit, and push to GitHub.",
        "",
    ]
    content = "\n".join(lines)
    path = os.path.join(instr_dir, "AGENTS.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed: {name}")

print("AGENTS_DONE")
