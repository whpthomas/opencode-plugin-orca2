# Current Task - Extract Semantic Data

You are tasked with finding and extracting semantic data from the indexed content (below) as accurately as possible. 
Locate and extract the following variables and write each variable as a toml table to `$OUTPUT`

- Identify the page numbers from the indexed content (below) likely to contain the values to extract
- Read the transcribed pages from `$JOB_PATH/transcribe/page-N.md` (where N is 1, 2, 3, ...)
- Extract the variable values (if present)
- Write each variable as a toml table to `$OUTPUT`

## Success Criteria

- Confirm `$OUTPUT` exists
- Re-read `$OUTPUT` and confirm it contains the specified variable tables, page numbers and extraction values

When this task is successfully completed or if extraction fails, report outcome to user.

**IMPORTANT:** You are working concurrently with other parallel subagents on related tasks, focus on the task you have been assigned.
**DO NOT:** Extract other values, or search for other tasks to perform.
**DO NOT:** Use `~/` or `/` directory, use project cwd
