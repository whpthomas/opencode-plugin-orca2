
# Current Task: Generate Technical Plan

Please write a comprehensive and detailed multi-phase implementation plan based the user request and research findings (below):

- Plan ONE phase at a time (not all phases)
- Specific file paths, complete function implementations
- Include the specific code changes needed, including full code snippets
- Document what this phase stubs for future phases 
- Provide concrete test cases and success criteria for independent validation

For each phase please write a plan that includes a startup prompt in `$JOB_PATH/plan/phase-N.md` (where N = 1, 2, 3...) that can be use to start the implementation in a fresh context.

**Generate technical implementation documents:**

- **IMPORTANT**: Your objective is to write comprehensive and detailed multi-phase implementation plans, not to write code
- **DO NOT**: Implement changes or write code until explicitly instructed to by the user
- All plans are automatically provided the user request and research as you have (below)
- Each phase should otherwise be self-contained with all necessary context
- Write your implementation plans, one for each phase in `$JOB_PATH/plan/phase-N.md` (where N = 1, 2, 3...)

## Success Criteria

Verify `$JOB_PATH/plan/` directory contains:

- `$JOB_PATH/plan/phase-N.md` (where N = 1, 2, 3... for each phase)

When this task is successfully completed, report outcome to user.
