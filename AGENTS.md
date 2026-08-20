<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`. Verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Strict Repository Hygiene Rule

Never commit internal working documents, review notes, audit files, planning files, handoff files, scratch files, or agent-only documentation to a public repository unless they are explicitly required for the project.

Public repositories must read like polished production projects, not internal review documents or AI workspaces.

For every public repo:

- Keep the README concise, clean, simple, and judge-friendly.
- Remove internal commentary, review language, audit notes, implementation chatter, and instructions meant for agents or developers only.
- Do not repeat the same information across multiple README sections.
- Avoid duplicate words, redundant explanations, repeated headings, and unnecessary sections.
- Do not expose internal workflow files or documents that don't help users understand, run, evaluate, or contribute to the project.
- Do not scatter README-style explanations across multiple files unless each file has a clear purpose.
- Do not create multiple commits that only repeat README cleanup, documentation polish, or similar changes when they can be grouped logically.
- Commit messages must describe the actual change clearly and must not repeatedly use vague messages such as `update README`, `polish README`, `fix docs`, or equivalent variations.
- Before committing, review the repository from an external user's or judge's perspective and remove anything that makes it look like an internal workspace, review artifact, or unfinished agent session.

Default rule: if a file or piece of documentation exists only for our internal workflow and is not needed by users, contributors, deployment, testing, or judging, it must stay out of the public repository.

## Checkpoint Push Rule

After every meaningful implementation checkpoint, commit the focused change with a short unique message and push `main` to GitHub.

Meaningful checkpoints include approved planning phases, database migrations, API endpoints, state guards, barriers, verification flows, repair logic, QA fixes, and submission-ready documentation.

Before each push:

- Confirm the tracked tree is clean except for the intended checkpoint.
- Confirm no `.env` files, credentials, local evidence, internal planning files, scratch files, or generated concepts are tracked.
- Confirm the commit author is `MystiqueMide <splashmediahub@gmail.com>`.
- Push only the focused checkpoint commit and its required ancestry.
