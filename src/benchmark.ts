import * as fs from 'fs';
import { parseProcessTOML } from './evaluate-process.js';
import type { ProcessTable } from './evaluate.js';

// ── Types ──────────────────────────────────────────────────────────

export type FieldMismatch = {
  field: string;
  expected: unknown;
  actual: unknown;
};

export type TableResult = {
  tableId: string;
  index: number;
  correct: number;
  total: number;
  pct: number;
  mismatches: FieldMismatch[];
};

export type BenchmarkResult = {
  score: number;
  totalFields: number;
  correctFields: number;
  tableResults: TableResult[];
};

// ── Comparison Logic ───────────────────────────────────────────────

/**
 * Normalize a value for comparison.
 * Numbers are coerced to strings; everything else compared as-is.
 */
function normalizeValue(val: unknown): string {
  if (val === undefined || val === null) return 'undefined';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return String(val);
  return String(val);
}

/**
 * Match expected tables against actual tables by tableId + arrayIndex.
 * Scalar tables (arrayIndex === null) match by tableId alone.
 * Array tables match by tableId + arrayIndex.
 *
 * If an expected table has no match in actual, all its fields count as mismatches.
 * If an actual table has no match in expected, it is ignored (extra output fields not scored).
 */
function matchTables(
  expected: ProcessTable[],
  actual: ProcessTable[]
): Array<{ expected: ProcessTable; actual: ProcessTable | null }> {
  const matches: Array<{ expected: ProcessTable; actual: ProcessTable | null }> = [];

  for (const exp of expected) {
    let match: ProcessTable | undefined;

    if (exp.arrayIndex === null) {
      // Scalar table: match by tableId only
      match = actual.find(a => a.tableId === exp.tableId && a.arrayIndex === null);
    } else {
      // Array table: match by tableId + arrayIndex
      match = actual.find(
        a => a.tableId === exp.tableId && a.arrayIndex === exp.arrayIndex
      );
    }

    matches.push({ expected: exp, actual: match ?? null });
  }

  return matches;
}

/**
 * Compare a single expected table against its matched actual table.
 * Returns the number of correct fields and the list of mismatches.
 */
function compareOneTable(
  expected: ProcessTable,
  actual: ProcessTable | null
): { correct: number; total: number; mismatches: FieldMismatch[] } {
  const expectedFields = expected.fields;
  const actualFields = actual?.fields ?? {};
  const mismatches: FieldMismatch[] = [];
  let correct = 0;

  for (const [key, expVal] of Object.entries(expectedFields)) {
    const actVal = actualFields[key];
    if (normalizeValue(expVal) === normalizeValue(actVal)) {
      correct++;
    } else {
      mismatches.push({
        field: key,
        expected: expVal,
        actual: actVal,
      });
    }
  }

  return {
    correct,
    total: Object.keys(expectedFields).length,
    mismatches,
  };
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Compare expected TOML against actual TOML and return a BenchmarkResult.
 *
 * @param expectedPath - Path to the ground-truth TOML file
 * @param actualPath - Path to the concatenated output TOML file
 * @returns BenchmarkResult with per-table and overall scores
 * @throws Error if either file cannot be read or parsed
 */
export function compareTOMLFiles(
  expectedPath: string,
  actualPath: string
): BenchmarkResult {
  const expectedTables = parseProcessTOML(expectedPath);
  const actualTables = parseProcessTOML(actualPath);
  return compareTables(expectedTables, actualTables);
}

/**
 * Compare expected ProcessTables against actual ProcessTables.
 * Core comparison logic — handles matching and scoring.
 */
export function compareTables(
  expected: ProcessTable[],
  actual: ProcessTable[]
): BenchmarkResult {
  const matched = matchTables(expected, actual);
  const tableResults: TableResult[] = [];
  let totalFields = 0;
  let correctFields = 0;

  for (const { expected: exp, actual: act } of matched) {
    const result = compareOneTable(exp, act);
    const pct = result.total > 0
      ? Math.round((result.correct / result.total) * 1000) / 10
      : 100;

    tableResults.push({
      tableId: exp.tableId,
      index: exp.arrayIndex ?? 0,
      correct: result.correct,
      total: result.total,
      pct,
      mismatches: result.mismatches,
    });

    totalFields += result.total;
    correctFields += result.correct;
  }

  const score = totalFields > 0
    ? Math.round((correctFields / totalFields) * 100)
    : 100;

  return {
    score,
    totalFields,
    correctFields,
    tableResults,
  };
}

// ── TOML Output ────────────────────────────────────────────────────

function escapeTomlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function serializeValue(val: unknown): string {
  if (val === undefined || val === null) return 'undefined';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `"${escapeTomlString(val)}"`;
  return JSON.stringify(val);
}

export function generateBenchmarkTOML(result: BenchmarkResult): string {
  const lines: string[] = [];

  lines.push('[summary]');
  lines.push(`score = ${result.score}`);
  lines.push(`total_fields = ${result.totalFields}`);
  lines.push(`correct_fields = ${result.correctFields}`);
  lines.push('');

  for (const tr of result.tableResults) {
    lines.push('[[table_result]]');
    lines.push(`table_id = "${escapeTomlString(tr.tableId)}"`);
    lines.push(`index = ${tr.index}`);
    lines.push(`correct = ${tr.correct}`);
    lines.push(`total = ${tr.total}`);
    lines.push(`pct = ${tr.pct}`);

    if (tr.mismatches.length > 0) {
      for (const m of tr.mismatches) {
        lines.push('');
        lines.push('  [[table_result.mismatches]]');
        lines.push(`  field = "${escapeTomlString(m.field)}"`);
        lines.push(`  expected = ${serializeValue(m.expected)}`);
        lines.push(`  actual = ${serializeValue(m.actual)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function writeBenchmarkTOML(
  result: BenchmarkResult,
  outputPath: string
): void {
  const content = generateBenchmarkTOML(result);
  fs.writeFileSync(outputPath, content, 'utf-8');
}

// ── HTML Output ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreBadgeClass(score: number): string {
  if (score >= 90) return 'bg-success';
  if (score >= 70) return 'bg-warning text-dark';
  return 'bg-danger';
}

function fieldStatusIcon(match: boolean): string {
  return match
    ? '<span class="text-success fw-bold">&#10003;</span>'
    : '<span class="text-danger fw-bold">&#10007;</span>';
}

export function generateBenchmarkHTML(
  stepName: string,
  jobName: string,
  result: BenchmarkResult
): string {
  const title = `Benchmark: ${stepName} (${jobName})`;

  let tablesHTML = '';
  for (const tr of result.tableResults) {
    const tableBadgeClass = scoreBadgeClass(tr.pct);

    let fieldsHTML = '';
    for (const m of tr.mismatches) {
      fieldsHTML += `
        <tr>
          <td>${fieldStatusIcon(false)} ${escapeHtml(m.field)}</td>
          <td class="text-danger"><code>${escapeHtml(String(m.expected))}</code></td>
          <td class="text-success"><code>${escapeHtml(String(m.actual))}</code></td>
        </tr>`;
    }

    tablesHTML += `
    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span><strong>${escapeHtml(tr.tableId)}</strong> [${tr.index}]</span>
        <span class="badge ${tableBadgeClass}">${tr.correct}/${tr.total} = ${tr.pct}%</span>
      </div>
      <div class="card-body p-0">
        ${tr.mismatches.length > 0 ? `
        <table class="table table-sm mb-0">
          <thead>
            <tr class="table-light">
              <th>Field</th>
              <th>Expected</th>
              <th>Actual</th>
            </tr>
          </thead>
          <tbody>
            ${fieldsHTML}
          </tbody>
        </table>
        ` : `
        <div class="text-success p-3 mb-0">
          <strong>All fields match</strong> (${tr.correct}/${tr.total})
        </div>
        `}
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #f8f9fa; }
    .score-hero {
      text-align: center;
      padding: 2rem 0;
    }
    .score-hero .display-1 {
      font-size: 4rem;
      font-weight: 700;
    }
    .card { box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card-header { font-size: 0.9rem; }
    code { font-size: 0.85rem; }
    .table td, .table th { vertical-align: middle; }
  </style>
</head>
<body>
  <div class="container py-4" style="max-width: 800px;">
    <h4 class="mb-4">${escapeHtml(title)}</h4>

    <div class="score-hero mb-4">
      <div class="display-1 ${scoreBadgeClass(result.score)} text-white rounded p-4">
        ${result.score}%
      </div>
      <div class="mt-2 text-muted">
        ${result.correctFields} / ${result.totalFields} fields correct
      </div>
    </div>

    ${tablesHTML}
  </div>
</body>
</html>`;
}

export function writeBenchmarkHTML(
  stepName: string,
  jobName: string,
  result: BenchmarkResult,
  htmlPath: string
): void {
  const content = generateBenchmarkHTML(stepName, jobName, result);
  fs.writeFileSync(htmlPath, content, 'utf-8');
}
