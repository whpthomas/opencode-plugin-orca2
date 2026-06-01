# Current Task: Convert PDF to Image

You have been provided with a tool call to convert a PDF file into PNG images (one image per page) named `pdf2img` described in the system prompt. Please use the `pdf2img` tool call in the following task.

- **DO:** Use `pdf2img` directly.
- **DO NOT:** call shell tool for this task.

**Find the PDF document and convert it:**

Could you please find the name of the pdf file in `$JOB_PATH/*.pdf` use the `pdf2img` tool call to convert this PDF file into PNG images.

## Success Criteria

Verify `$JOB_PATH/pdf2img/` directory contains:

- `$JOB_PATH/pdf2img/page-N.png` (where N is 1, 2, 3, ...)

When this task is successfully completed, report outcome to user.
