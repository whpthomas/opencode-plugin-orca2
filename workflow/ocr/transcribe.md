# Current Task: Transcribe Page Image

You are tasked with transcribing an image of a document page as accurately as possible.

- Please read `$JOB_PATH/pdf2img/$EACH.png` and transcribe page content to text
- Write it as markdown to `$OUTPUT`

## Output Format

Maintain content formatting as best you can

- Start page with `# Page $INDEX`
- Headings: Use ## ### #### for H2/H3/H4 levels
- Tables: Use | column | separators with alignment row
- Lists: Use - for bullets, 1. for numbered
- Formatting: **bold**, *italic*, `code`, > quotes
- Preserve all content, structure, and hierarchy

## Success Criteria

Verify `$OUTPUT` contains transcribed content read from `$JOB_PATH/pdf2img/$EACH.png` as markdown.

When this task is successfully completed or the process unexpectedly fails, report outcome to user.

**IMPORTANT:** You are working concurrently with other parallel subagents on related tasks, focus on the task you have been assigned.
**DO NOT:** Transcribe other pages, or search for other tasks to perform.
