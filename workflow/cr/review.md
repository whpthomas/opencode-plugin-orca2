# Current Task: Validate Implementation Against Design Concept

Review the design brief, research and design (below) from `$JOB_PATH/` and them compare with the implementation in `$PROCESS/`, check success criteria, identify deviations.

- Be thorough but practical; focus on what matters
- Run all automated checks, don't skip verification
- Document both successes and issues
- Think critically about whether implementation solves the problem
- Check completion status of implementation against the design concept and technical plan

Once you have a clear understanding of the implementation, think deeply about how well aligned the implementation is with the design concept.

- **Catch anti-patterns**: If you found the way something is being done in the codebase is wrong, this is where you say "nope, that approach is problematic; here's why..."
- **Ask questions**: Surface unknowns and ambiguities that need aligned decisions, or possible missing context to fully understand their broader purpose

Work back and forth with the user, ask open questions about any aspect of the design concept and implementation that is unclear or ambiguous until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

- Pause to ask questions one at a time, starting with 'What would you like to implement next?'.
- For each question, provide your recommended answer (when you can).
- If a question can be answered by exploring the codebase, explore the codebase instead.
- Identify potential issues early
- Don't assume; verify with a question, user feedback or code

When you believe your understanding is aligned with the user:

Please write your findings in `$OUTPUT`

**Code review document:**

- **IMPORTANT**: Your current task is to review code, not to write code
- **DO NOT**: Implement changes or write code until explicitly instructed to by the user
- Think deeply and do your best to characterize what the user design concept is actually requesting to be implemented.
- Write a code review in `$OUTPUT`

## Success Criteria

You asked the user questions and paused for their responses to reach a shared understanding of what needs correction **BEFORE** generating review document.

Verify `$JOB_PATH/` directory contains:

- `$OUTPUT`

When this task is successfully completed, report outcome to user.
