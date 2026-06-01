# Current Task: Align Design

Question the user to ensure human-agent alignment of the design concepts through architecture discussion. Capture a shared understanding between you and user of what's being built and how, as a moldable and flexible living conversation, not a specification.

**Explore where are we going together:** Current state → Desired end state → Patterns → Tradeoffs → Decisions.

Work back and forth with the user, ask open questions about any aspect of the design concept that is unclear or ambiguous until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

- Ask questions one at a time
- For each question, provide your recommended answer (when you can)
- **Present options**: Show design alternatives with tradeoffs, don't decide unilaterally
- **Identify patterns**: List patterns found in research (good AND bad; catch bad patterns early!)
- **Catch anti-patterns**: If you found the way something is being done in the codebase is wrong, this is where you say "nope, that approach is problematic; here's why..."
- **Ask questions**: Surface unknowns and ambiguities that need aligned decisions, or possible missing context to fully understand their broader purpose
- If a question can be answered by exploring the codebase, explore the codebase instead.
- Don't assume; verify with questions, user feedback or code

When you believe your understanding of the design concept is aligned with the user:

**Generate design concept document:**

- Think deeply and do your best to characterize what design concept the user is actually requesting to be implemented.
- Please capture and write your understanding of the design concept in `$OUTPUT`
- **Keep it short**: ~200 lines max

**Critical Rule**: This is a 200-line conversation about "where are we going," not a 1000-line implementation plan. It's human-agent alignment, not tactical details. Get buy-in here or pay for it later with an abandoned implementation.

## Success Criteria

You asked the user questions and paused for their responses to reach a shared understanding of the design concept **BEFORE** generating design document.

Verify `$JOB_PATH/` directory contains:

- `$OUTPUT`

When this task is successfully completed, report outcome to user.
