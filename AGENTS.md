# Orca2 Plugin

TypeScript OpenCode plugin (`@opencode-ai/plugin` v1.4.10) that orchestrates agentic workflows via TOML definitions using file existence as state.

## Build/Test

```bash
bun run build     # tsc → dist/
bun run dev       # tsc --watch
bun run clean     # rm -rf dist
bun test          # all tests (bun:test)
# Focused:
bun test toml-parser        # TOML parsing tests
bun test workflow           # workflow orchestration tests
bun test variables          # variable substitution tests
bun test step               # step logic tests
bun test hooks              # hook tests
```

## Architecture

- **Entry**: `src/index.ts` exports `orca2Plugin`, registers 3 hooks, stores OpenCode client via `setClient()`
- **State**: module-level `Map<string, Workflow>` keyed by sessionID (`src/state.ts`)
- **Hooks**: `chat.message` (parse `#{...}` invocation), `experimental.chat.messages.transform` (strip context, send "Hello"), `event` (advance on `session.idle`)
- **Logging**: writes to `.logs/orca2.log` (cleared on plugin init)

For up-to-date specification read: `NEW_SPEC.md`

### Class Map

| File | Role |
|------|------|
| `workflow.ts` | State machine: FIRST → NEXT → PAUSED / ERROR / CANCELLED / DONE |
| `step.ts` | Step logic with 4 machine types: STEP, ITERATE, WHILE, PROCESS |
| `task.ts` | Per-subtask retry tracking (in-memory only, reset on `load()`) |
| `subtask.ts` | Prompt container for child sessions |
| `variables.ts` | Template substitution (`$PROJECT_PATH`, `$WORKFLOW`, `$STEP`, `$EACH`, etc.) |
| `toml-parser.ts` | Parses `workflow/<name>.toml`, validates required fields |
| `types.ts` | `TOMLWorkflowConfig`, `TOMLStepConfig` interfaces |
| `logger.ts` | File-based logger to `.logs/orca2.log` |

### Step Status Machine

```
States (Status enum): PENDING → RETRY → SUBTASK_COMPLETE → STEP_DONE / HALT

Machine × Modifier behavior:
  Step:            RETRY→continue, STEP_DONE→next step, HALT→halt
  Step+subtask:    RETRY→spawn subtask
  Step+dialog:     pauses on RETRY, waits for user
  Iterate:         RETRY→next subtask, STEP_DONE→next step, HALT→skip if !HITL
  Iterate+subtask: RETRY→spawn one subtask at a time
  Iterate+parallel: RETRY→spawn all subtasks
  While:           RETRY→continue, SUBTASK_COMPLETE→next step or loop
  While+subtask:   RETRY→spawn subtask
  While+loop:      SUBTASK_COMPLETE→jump to loop target step
  Process:         same as Iterate (but reads from `process/<process>/`)
```

## Invocation

```
#{workflow job [process]}
```

- `workflow` = TOML filename (`workflow/<name>.toml`)
- `job` = job identifier slug
- `process` = optional process identifier
- Arguments support quoting: `#{wf "my job" proc}`

## Path Resolution

| `single_file` | Input base | Output base |
|:---:|---|---|
| `false` (default) | `thoughts/<job>/` | `thoughts/<job>/` |
| `true` | `<job>/` | `<job>/` |

Step prompts: `workflow/<workflow>/<step>.md` (resolved relative to CWD)
Optional system prompt: `workflow/<workflow>.md`
Process prompts: `process/<process>/<step>.md`

## Variables

| Variable | Resolves to |
|----------|-------------|
| `$PROJECT_PATH` | CWD |
| `$JOB_PATH` | Full job directory path |
| `$JOB` | `basename(jobPath)` |
| `$WORKFLOW` | Workflow name |
| `$PROCESS` | Process identifier |
| `$STEP` | Current step name |
| `$INPUT` | Resolved input path (step or subtask) |
| `$OUTPUT` | Resolved output path (step or subtask) |
| `$EACH` | Iteration filename (no ext) |
| `$INDEX` | 1-indexed iteration number |

## TOML Step Fields (current implementation)

```
name, description         — required
prompt (string|string[])  — optional
input (string)            — optional
output (string)           — optional
subtask                   — spawn one child subtask at a time
parallel                  — spawn all child subtasks
dialog                    — pause for user input, wait for output file
generate (boolean)        — this step generates files
iterate (string)          — iterate files in subdirectory relative to job
while (string)            — iterate files across multiple steps
loop (string)             — jump to named step on subtask complete
process (boolean)         — read from process/<process>/ directory
concatenate (string)      — single output path (template = this.output)
evaluate (string)         — single output path (input = concatenate.output)
retry (number)            — per-step retry override
HITL (boolean)            — halt instead of skip on exhausted retries
```

**Gotcha**: `concatenate` is a single string (concatenated output path). The template pattern is `this.output` — `$EACH.md` → reads `<step-dir>/*.md`, concatenates sorted to `<concatenate-path>`.

## Cancellation Detection

If `nextPrompt()` is called within **3 seconds** of the last retry, the workflow enters `CANCELLED` state. This detects the user hitting escape twice rapidly.

## Context Management

- Default: steps and tasks are inferenced sequentially within the main context window. Only step prompts from subsequent steps and or input prompts from subsequent are included.
- On resume: the current step rebuilds the full prompt and continue
- Parallel and subtask modifiers: spawn independent child sessions that build full prompts.

## Testing Conventions

- Tests clean up fixture directories **at the start** of each test, not the end
- Tests use `bun:test` (import `{ test, expect, describe, mock }`)
- Mock `../../src/state` with `mock.module()` when testing hooks
- Tests write TOML and MD files to dedicated per-test fixture dirs in `tests/fixtures/`
