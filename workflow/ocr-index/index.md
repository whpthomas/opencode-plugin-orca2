# Current Task - Generate Index

You are tasked with indexing semantic information from the content of page content (below) as accurately as possible.

Please review `$INPUT` content (below), think about what semantic information is on this page. In future, if you were searching through an index (like at the back of a textbook) for specific information; what information stands out to you on this page? There may be a lot of information, there may be very little information. Please create an index of semantic information for this page in `$OUTPUT`. If necessary, you may refer to the previous page or the subsequent page `$JOB_PATH/transcribe/page-N.md` (when N is $0 + 1 or - 1) for widow/orphan paragraph context if necessary. However limit the scope of the index to information specifically on the page. For example if the start of the page belongs to a section from a previous page, the section might be `## Section <number>: Heading (Continued)`.

## Output Format

Provide helpful semantic information as best you can. Page content will vary, so only include content blocks relevant to this actual document page.  

**Page Number:**

```markdown
# Page $INDEX
```

**Tags:**

```markdown
## Tags
- <list of tags>
```

**Metadata:**

```markdown
## Metadata
- <list of metadata>
```

**Term Definitions:**

If the page contains terms, define them, if not omit definitions content block altogether.

```markdown
## Definitions
- **<term>:** <definition>
```

**Either Flat Headings or Numerical Section Headings:**

Some document pages may use flat headings, if not consider numerical section headings.

```markdown
## <heading>
    - <list of key content summarized>

## <heading>
    - <list of key content summarized>

## <heading>
    - <list of key content summarized>

etc ...
```

Some document pages may have nested numerical section headings, if not consider flat headings.

```markdown
## <number> <heading>
    - <list of key content summarized>

### <number>.<number> <heading>
    - <list of key content summarized>

#### <number>.<number>.<number> <heading>
    - <list of key content summarized>

etc ...
```

**Figures:**

Some document pages may contain figures, list them, if not omit figures content block altogether.

```markdown
## Figures
- **figure <number>:** <description>
```

**Tables:**

Some document pages may contain tables, list the schema and characterize their content, if not omit tables content block altogether.

```markdown
## Tables
- **table:** <description>
    - **<field-name>:** <description>
```

## Success Criteria

- Verify `$OUTPUT` contains semantic information derived from `$INPUT` content (below).
- Read back `$OUTPUT` and confirm content adheres to output format guidelines (above).

When this task is successfully completed, report outcome to user.
