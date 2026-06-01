
# Current Task: Generate Revision Plan

Please write a comprehensive and detailed multi-phase plan to revise the codebase based on your findings:

- Plan ONE revision at a time (not all revisions)
- Specific file paths, complete function implementations
- Include the specific code changes needed, including full code snippets
- Provide updated test cases and success criteria where appropriate for independent validation

For each revision you write in `$JOB_PATH/revisions/revision-N.md` (where N = 1, 2, 3...) please include a startup prompt that can be use to start the change implementation in a fresh context.

**Generate technical implementation documents:**

- **IMPORTANT**: Your objective is to write comprehensive and detailed multi-phase implementation plans, not to write code
- **DO NOT**: Implement changes or write code until explicitly instructed to by the user
- All plans are automatically provided the user request and research as you have (below)
- Each phase should otherwise be self-contained with all necessary context
- Write your implementation plans, one for each phase in `$JOB_PATH/revisions/revision-N.md` (where N = 1, 2, 3...)

## Success Criteria

Verify `$JOB_PATH/revisions/` directory contains:

- `$JOB_PATH/revisions/revision-N.md` (where N = 1, 2, 3... for each phase)

When this task is successfully completed, report outcome to user.
