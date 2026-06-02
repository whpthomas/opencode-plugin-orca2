import { parse } from 'toml';
import * as path from 'path';
import * as fs from 'fs';
import { generateProcessEvalHTML, type ProcessTable, type ProcessComparison, type ProcessEvalData } from './evaluate';

/**
 * Parse a concatenated TOML file and extract all tables.
 * Permissive parsing: handles any TOML structure, any fields.
 * 
 * @param tomlPath - Path to the concatenated TOML file
 * @returns Array of ProcessTable objects
 */
function preprocessTomlContent(raw: string): string {
  const lines = raw.split('\n');
  return lines.map(line => {
    if (!line.includes('=')) return line;

    const idx = line.indexOf('=');
    const valueRaw = line.slice(idx + 1);
    const valueTrimmed = valueRaw.trim();

    if (!valueTrimmed) return line;

    // Already quoted string
    if (valueTrimmed.startsWith('"') || valueTrimmed.startsWith("'")) return line;

    // Bare undefined → quoted string
    if (valueTrimmed === 'undefined') {
      return line.slice(0, idx + 1) + ' "undefined"';
    }

    // Valid TOML bare literals: integers, floats, booleans, infinity, dates
    if (/^[+-]?(\d[\d_]*\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(valueTrimmed)) return line;
    if (/^(true|false|inf|nan|infinity|-infinity)$/i.test(valueTrimmed)) return line;

    // Inline arrays or already-quoted
    if (/^[\[{]/.test(valueTrimmed)) return line;

    // Bare string — wrap in quotes
    return line.slice(0, idx + 1) + ' "' + valueTrimmed + '"';
  }).join('\n');
}

export function parseProcessTOML(tomlPath: string): ProcessTable[] {
  const raw = fs.readFileSync(tomlPath, 'utf-8');
  const content = preprocessTomlContent(raw);
  const data = parse(content);
  
  const tables: ProcessTable[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      // Array of tables: [[identifier]]
      const arrayItems = value as Record<string, unknown>[];
      arrayItems.forEach((item, index) => {
        tables.push({
          tableId: key,
          arrayIndex: index,
          totalArrayItems: arrayItems.length,
          fields: item
        });
      });
    } else if (typeof value === 'object' && value !== null) {
      // Scalar table: [identifier]
      tables.push({
        tableId: key,
        arrayIndex: null,
        totalArrayItems: 1,
        fields: value as Record<string, unknown>
      });
    }
    // Skip non-table values (top-level primitives)
  }
  
  return tables;
}

/**
 * Group tables by their page field value.
 * Pages are sorted ascending, with null pages (undefined/"no") at the end.
 * 
 * @param tables - Array of ProcessTable objects
 * @param jobPath - Base path for resolving source images
 * @returns Array of ProcessComparison objects grouped by page
 */
export function groupByPage(tables: ProcessTable[], jobPath: string): ProcessComparison[] {
  const groups = new Map<number | string, ProcessTable[]>();
  
  // Group tables by page
  for (const table of tables) {
    const pageValue = table.fields['page'];
    let pageKey: number | string;
    
    if (pageValue === undefined || pageValue === 'no' || pageValue === 'undefined') {
      pageKey = 'null';
    } else if (typeof pageValue === 'number') {
      pageKey = pageValue;
    } else if (typeof pageValue === 'string' && /^\d+$/.test(pageValue)) {
      pageKey = parseInt(pageValue, 10);
    } else {
      pageKey = 'null'; // Unknown page value
    }
    
    if (!groups.has(pageKey)) {
      groups.set(pageKey, []);
    }
    groups.get(pageKey)!.push(table);
  }
  
  // Convert to ProcessComparison array
  const comparisons: ProcessComparison[] = [];
  
  // Sort: numeric pages first, then null
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'null') return 1;
    if (b === 'null') return -1;
    return (a as number) - (b as number);
  });
  
  for (const key of sortedKeys) {
    const pageNum = key === 'null' ? null : key as number;
    let sourcePath: string | null = null;
    
    if (pageNum !== null) {
      sourcePath = path.join(jobPath, 'pdf2img', `page-${pageNum}.png`);
      // Check if file exists
      if (!fs.existsSync(sourcePath)) {
        sourcePath = null;
      }
    }
    
    comparisons.push({
      pageNum,
      sourcePath,
      sourceType: sourcePath ? 'image' : 'missing',
      tables: groups.get(key)!
    });
  }
  
  return comparisons;
}

/**
 * Main function to parse a process TOML file and prepare evaluation data.
 * 
 * @param tomlPath - Path to concatenated TOML file
 * @param jobPath - Base job path for resolving source images
 * @param stepName - Step name for HTML title
 * @param jobName - Job name for HTML title
 * @returns ProcessEvalData object
 */
export function prepareProcessEval(
  tomlPath: string,
  jobPath: string,
  stepName: string,
  jobName: string
): ProcessEvalData {
  const tables = parseProcessTOML(tomlPath);
  const comparisons = groupByPage(tables, jobPath);
  
  return {
    stepName,
    jobName,
    comparisons
  };
}

/**
 * Main function to parse a process TOML file, prepare evaluation data, and generate HTML.
 * 
 * @param tomlPath - Path to concatenated TOML file
 * @param jobPath - Base job path for resolving source images
 * @param stepName - Step name for HTML title
 * @param jobName - Job name for HTML title
 * @param htmlPath - Output path for the HTML file
 * @returns Generated HTML string
 */
export function generateProcessEval(
  tomlPath: string,
  jobPath: string,
  stepName: string,
  jobName: string,
  htmlPath: string
): string {
  const tables = parseProcessTOML(tomlPath);
  const comparisons = groupByPage(tables, jobPath);
  
  const html = generateProcessEvalHTML(stepName, jobName, comparisons, htmlPath, tomlPath);
  
  // Write to file if htmlPath is provided
  if (htmlPath) {
    fs.writeFileSync(htmlPath, html, 'utf-8');
  }
  
  return html;
}
