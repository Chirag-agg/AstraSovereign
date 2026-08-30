# AGENTS.md

## AI Execution Constraints

- Always route initial repository scanning, directory tree parsing, and basic boilerplate tasks to `deepseek-v4-flash`.
- For deep mathematical logic, unit test loops, or structural bugs, invoke `gpt-5.6-sol`.
- Do not add dependencies or NPM modules unless explicitly requested.
