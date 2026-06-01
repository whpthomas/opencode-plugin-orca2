# Current Task: Research Codebase

Analyze and decompose the user request (below). Conduct comprehensive research across the codebase. Analyze the codebase thoroughly by exploring relevant modules, components and data flow.

**Generate research document:**

- **IMPORTANT**: Your current task is to research codebase, find facts and report findings, not critique, not to write code
- **DO NOT**: Implement changes or write code until explicitly instructed to by the user
- Focus on finding concrete file paths and line numbers for implementation reference
- Consider cross-component connections and architectural patterns
- Spawn parallel subtasks:
  - **locator**: Find where files/components live (grep/glob/ls)
  - **analyzer**: Understand how specific code works (trace data flow, entry points, patterns)
- Wait for all subtasks to complete, then synthesize findings
- Research documents should be self-contained with all necessary context
- Write your findings in `$OUTPUT`

## Success Criteria

Verify `$JOB_PATH/` directory contains:

- `$OUTPUT`

When this task is successfully completed, report outcome to user.
