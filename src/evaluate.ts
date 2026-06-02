import * as fs from 'fs';
import * as path from 'path';

export type Comparison = {
  sourcePath: string | null;
  sourceType: string;
  outputPath: string | null;
  outputType: string;
  each: string;
  index: number;
};

// Process evaluation types

export type ProcessTable = {
  tableId: string;           // e.g. "commercial-electricity-tariff"
  arrayIndex: number | null; // index for array-of-tables, null for scalar
  totalArrayItems: number;   // total items if array-of-tables, 1 for scalar
  fields: Record<string, unknown>;  // all TOML fields (page, value, unit, notes, etc.)
};

export type ProcessComparison = {
  pageNum: number | null;    // page number or null for undefined/"no"
  sourcePath: string | null; // pdf2img/page-N.png or null
  sourceType: string;        // 'image' | 'missing' | 'text'
  tables: ProcessTable[];    // all tables referencing this page
};

export type ProcessEvalData = {
  stepName: string;
  jobName: string;
  comparisons: ProcessComparison[];
};

export function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    return 'image';
  }
  if (ext === '.md') {
    return 'markdown';
  }
  return 'text';
}

export function renderContent(filePath: string | null, fileType: string, htmlPath: string): string {
  if (fileType === 'missing' || !filePath) {
    return '<div class="text-muted fst-italic">File not found</div>';
  }

  try {
    if (fileType === 'image') {
      const relativePath = path.relative(path.dirname(htmlPath), filePath);
      const basename = path.basename(filePath);
      return `<img src="${relativePath}" alt="${basename}">`;
    }

    if (fileType === 'markdown') {
      const content = fs.readFileSync(filePath, 'utf-8');
      return `<div class="markdown-content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return `<pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  } catch {
    return '<div class="text-danger">Error reading file</div>';
  }
}

export function generateEvalHTML(
  stepName: string,
  jobName: string,
  comparisons: Comparison[],
  htmlPath: string
): string {
  const totalItems = comparisons.length;

  let itemsHTML = '';
  for (let i = 0; i < comparisons.length; i++) {
    const comp = comparisons[i];
    const leftContent = renderContent(comp.sourcePath, comp.sourceType, htmlPath);
    const rightContent = renderContent(comp.outputPath, comp.outputType, htmlPath);

    itemsHTML += `
      <div class="comparison-item" data-index="${i}" ${i === 0 ? 'style="display: block;"' : 'style="display: none;"'}>
        <div class="row g-3">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">Source (${comp.each})</div>
              <div class="card-body content-box">${leftContent}</div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">Output (${comp.each})</div>
              <div class="card-body content-box">${rightContent}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Evaluate ${stepName} — ${jobName}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
      body {
        background: #f8f9fa;
      }
      .content-box {
        min-height: 200px;
        background: #fff;
        font-size: 0.925rem;
        line-height: 1.65;
        color: #212529;
        padding: 1.25rem;
      }
      .content-box img {
        max-width: 100%;
        height: auto;
      }
      .content-box pre {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 0.375rem;
        overflow-x: auto;
        margin: 0.75rem 0;
      }
      .markdown-content h1,
      .markdown-content h2,
      .markdown-content h3,
      .markdown-content h4 {
        margin-top: 1.25rem;
        margin-bottom: 0.5rem;
        font-weight: 600;
        line-height: 1.3;
      }
      .markdown-content h1:first-child,
      .markdown-content h2:first-child,
      .markdown-content h3:first-child,
      .markdown-content h4:first-child {
        margin-top: 0;
      }
      .markdown-content h1 { font-size: 1.5rem; }
      .markdown-content h2 { font-size: 1.3rem; }
      .markdown-content h3 { font-size: 1.15rem; }
      .markdown-content h4 { font-size: 1.05rem; }
      .markdown-content p {
        margin-bottom: 0.75rem;
      }
      .markdown-content ul,
      .markdown-content ol {
        padding-left: 1.5rem;
        margin-bottom: 0.75rem;
      }
      .markdown-content li {
        margin-bottom: 0.25rem;
      }
      .markdown-content blockquote {
        border-left: 3px solid #dee2e6;
        padding-left: 1rem;
        margin: 0.75rem 0;
        color: #6c757d;
        font-style: italic;
      }
      .markdown-content code {
        background: #f1f3f5;
        padding: 0.15rem 0.35rem;
        border-radius: 0.25rem;
        font-size: 0.875em;
      }
      .markdown-content pre {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 0.375rem;
        overflow-x: auto;
        margin: 0.75rem 0;
      }
      .markdown-content pre code {
        background: none;
        padding: 0;
      }
      .markdown-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.75rem 0;
      }
      .markdown-content th,
      .markdown-content td {
        border: 1px solid #dee2e6;
        padding: 0.5rem 0.75rem;
        text-align: left;
      }
      .markdown-content th {
        background: #f8f9fa;
        font-weight: 600;
      }
      .markdown-content hr {
        border: none;
        border-top: 1px solid #dee2e6;
        margin: 1rem 0;
      }
      .markdown-content a {
        color: #0d6efd;
        text-decoration: none;
      }
      .markdown-content a:hover {
        text-decoration: underline;
      }
      .card {
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
      .card-header {
        font-weight: 500;
        font-size: 0.875rem;
      }
      .nav-controls {
        position: sticky;
        top: 0;
        background: #f8f9fa;
        padding: 0.75rem 0;
        z-index: 100;
        border-bottom: 1px solid #dee2e6;
      }
      .comparison-item {
        padding: 1rem 0;
      }
    </style>
  </head>
  <body>
    <div class="nav-controls">
      <div class="container-fluid">
        <div class="d-flex justify-content-between align-items-center">
          <button class="btn btn-outline-secondary btn-sm" id="prevBtn" ${totalItems <= 1 ? 'disabled' : ''}>
            &larr; Previous
          </button>
          <span class="text-muted" id="itemCount">1 / ${totalItems}</span>
          <button class="btn btn-outline-secondary btn-sm" id="nextBtn" ${totalItems <= 1 ? 'disabled' : ''}>
            Next &rarr;
          </button>
        </div>
      </div>
    </div>

    <div class="container-fluid">
      ${itemsHTML}
    </div>

    <script>
      (function() {
        var currentIndex = 0;
        var totalItems = ${totalItems};
        var items = document.querySelectorAll('.comparison-item');
        var prevBtn = document.getElementById('prevBtn');
        var nextBtn = document.getElementById('nextBtn');
        var itemCount = document.getElementById('itemCount');

        function updateView() {
          items.forEach(function(item, i) {
            item.style.display = i === currentIndex ? 'block' : 'none';
          });
          prevBtn.disabled = currentIndex === 0;
          nextBtn.disabled = currentIndex === totalItems - 1;
          itemCount.textContent = (currentIndex + 1) + ' / ' + totalItems;
        }

        prevBtn.addEventListener('click', function() {
          if (currentIndex > 0) {
            currentIndex--;
            updateView();
          }
        });

        nextBtn.addEventListener('click', function() {
          if (currentIndex < totalItems - 1) {
            currentIndex++;
            updateView();
          }
        });

        document.addEventListener('keydown', function(e) {
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
            currentIndex--;
            updateView();
          } else if (e.key === 'ArrowRight' && currentIndex < totalItems - 1) {
            currentIndex++;
            updateView();
          }
        });

        document.querySelectorAll('.markdown-content').forEach(function(el) {
          el.innerHTML = marked.parse(el.textContent);
        });
      })();
    </script>
  </body>
</html>`;
}

/**
 * Helper function to escape HTML entities.
 */
function escapeHtml(text: string | number | boolean | undefined | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape text for safe use in HTML attribute values.
 */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert any TOML value to a string for input attributes.
 */
function valueToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/**
 * Render TOML table data as HTML key-value pairs.
 * Handles both scalar and array-of-tables.
 * 
 * @param table - ProcessTable object
 * @returns HTML string
 */
export function renderProcessContent(table: ProcessTable): string {
  const dataIdx = table.arrayIndex ?? -1;
  let html = `<div class="table-entry mb-3" data-table="${escapeAttr(table.tableId)}" data-array-index="${dataIdx}">`;
  
  // Table header with ID and array index if applicable
  html += `<h6 class="table-id">${escapeHtml(table.tableId)}`;
  if (table.arrayIndex !== null) {
    html += ` <span class="badge bg-secondary">${table.arrayIndex + 1}/${table.totalArrayItems}</span>`;
  }
  html += '</h6>';
  
  // Key-value pairs
  html += '<dl class="row mb-0">';
  
  for (const [key, value] of Object.entries(table.fields)) {
    html += '<dt class="col-sm-3 text-muted">' + escapeHtml(key) + '</dt>';
    html += '<dd class="col-sm-9">';

    if (typeof value === 'boolean') {
      html += `<select class="form-select form-select-sm"
                data-table="${escapeAttr(table.tableId)}"
                data-index="${dataIdx}"
                data-field="${escapeAttr(key)}">`;
      html += `<option value="true"${value === true ? ' selected' : ''}>true</option>`;
      html += `<option value="false"${value === false ? ' selected' : ''}>false</option>`;
      html += '</select>';
    } else if (typeof value === 'string' && value.length > 80) {
      html += `<textarea class="form-control form-control-sm" rows="3"
                data-table="${escapeAttr(table.tableId)}"
                data-index="${dataIdx}"
                data-field="${escapeAttr(key)}">${escapeHtml(value)}</textarea>`;
    } else {
      const inputType = typeof value === 'number' ? 'number' : 'text';
      const attrVal = escapeAttr(valueToString(value));
      html += `<input type="${inputType}" class="form-control form-control-sm"
                data-table="${escapeAttr(table.tableId)}"
                data-index="${dataIdx}"
                data-field="${escapeAttr(key)}"
                value="${attrVal}">`;
    }

    html += '</dd>';
  }
  
  html += '</dl>';
  html += '</div>';
  
  return html;
}

/**
 * Generate HTML for a single page group (all tables from that page).
 * 
 * @param comparison - ProcessComparison object
 * @param index - 0-based index of this comparison
 * @param htmlPath - HTML file path for relative path resolution
 * @returns HTML string
 */
function renderPageGroup(comparison: ProcessComparison, index: number, htmlPath: string): string {
  let html = `<div class="comparison-item" data-index="${index}" style="display: ${index === 0 ? 'block' : 'none'};">`;
  html += '<div class="row g-3">';
  
  // Left column: Source page image
  html += '<div class="col-md-6">';
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += `<strong>Source: Page ${comparison.pageNum ?? 'N/A'}</strong>`;
  html += '</div>';
  html += '<div class="card-body content-box">';
  
  if (comparison.sourcePath && comparison.sourceType === 'image') {
    // Calculate relative path for the HTML file
    const relativePath = htmlPath ? path.relative(path.dirname(htmlPath), comparison.sourcePath) : comparison.sourcePath;
    html += `<img src="${escapeHtml(relativePath)}" class="img-fluid" alt="Page ${comparison.pageNum}">`;
  } else {
    html += '<div class="alert alert-warning">';
    html += '<em>No source page available</em>';
    html += '</div>';
  }
  
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  // Right column: TOML table data
  html += '<div class="col-md-6">';
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<strong>Extracted Data</strong>';
  html += '</div>';
  html += '<div class="card-body content-box">';
  
  if (comparison.tables.length === 0) {
    html += '<em class="text-muted">No data extracted for this page</em>';
  } else {
    for (const table of comparison.tables) {
      html += renderProcessContent(table);
    }
  }
  
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  return html;
}

/**
 * Generate a static HTML page for process evaluation.
 * Displays TOML table values grouped by page, side-by-side with source images.
 * 
 * @param stepName - Step name for HTML title
 * @param jobName - Job name for HTML title
 * @param comparisons - Array of ProcessComparison objects
 * @param htmlPath - Output path for the HTML file
 * @param tomlPath - Original TOML file path for save metadata
 * @returns Generated HTML string
 */
export function generateProcessEvalHTML(
  stepName: string,
  jobName: string,
  comparisons: ProcessComparison[],
  htmlPath: string,
  tomlPath?: string
): string {
  const title = `Process Evaluation: ${stepName} (${jobName})`;
  const totalItems = comparisons.length;
  
  // Build JSON data from all tables
  const allTables: ProcessTable[] = [];
  for (const c of comparisons) {
    allTables.push(...c.tables);
  }
  const jsonData = JSON.stringify(allTables, null, 2);
  
  let itemsHTML = '';
  for (let i = 0; i < comparisons.length; i++) {
    itemsHTML += renderPageGroup(comparisons[i], i, htmlPath);
  }
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="toml-path" content="${escapeAttr(tomlPath || '')}">
  <title>${escapeHtml(title)}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      background: #f8f9fa;
    }
    .content-box {
      min-height: 200px;
      background: #fff;
      font-size: 0.925rem;
      line-height: 1.65;
      color: #212529;
      padding: 1.25rem;
    }
    .content-box img {
      max-width: 100%;
      height: auto;
    }
    .table-entry {
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 1rem;
    }
    .table-entry:last-child {
      border-bottom: none;
    }
    .table-id {
      color: #495057;
      font-weight: 600;
      font-size: 0.95rem;
    }
    dt {
      font-weight: 400;
    }
    dd {
      font-family: monospace;
      font-size: 0.9rem;
    }
    .card {
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .card-header {
      font-weight: 500;
      font-size: 0.875rem;
    }
    .nav-controls {
      position: sticky;
      top: 0;
      background: #f8f9fa;
      padding: 0.75rem 0;
      z-index: 100;
      border-bottom: 1px solid #dee2e6;
    }
    .comparison-item {
      padding: 1rem 0;
    }
    .table-entry .form-control,
    .table-entry .form-select {
      font-family: monospace;
      font-size: 0.875rem;
      background-color: #fffde7;
      border: 1px solid #e0e0e0;
    }
    .table-entry .form-control:focus,
    .table-entry .form-select:focus {
      background-color: #fff;
      border-color: #86b7fe;
      box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
    }
    .table-entry textarea.form-control {
      resize: vertical;
      min-height: 60px;
    }
    #saveBtn:disabled {
      opacity: 0.5;
    }
    #statusMsg {
      transition: opacity 0.3s;
    }
    .form-control.is-dirty,
    .form-select.is-dirty {
      background-color: #fff3cd !important;
      border-color: #ffc107 !important;
    }
    .form-control.is-dirty:focus,
    .form-select.is-dirty:focus {
      background-color: #fff !important;
      border-color: #ffc107 !important;
      box-shadow: 0 0 0 0.2rem rgba(255, 193, 7, 0.25) !important;
    }
    .form-control.is-saved,
    .form-select.is-saved {
      transition: background-color 0.5s;
      background-color: #d4edda !important;
      border-color: #28a745 !important;
    }
  </style>
</head>
<body>
  <div class="nav-controls">
    <div class="container-fluid">
      <div class="d-flex justify-content-between align-items-center">
        <span class="navbar-brand mb-0 h1">${escapeHtml(title)}</span>
        <div class="d-flex align-items-center">
          <button class="btn btn-outline-primary btn-sm me-2" id="prevBtn" ${totalItems <= 1 ? 'disabled' : ''}>
            ← Previous
          </button>
          <span id="counter" class="me-2">1 / ${totalItems}</span>
          <span id="dirtyBadge" class="badge bg-warning text-dark me-2" style="display: none;">
            Unsaved changes
          </span>
          <button class="btn btn-outline-primary btn-sm me-3" id="nextBtn" ${totalItems <= 1 ? 'disabled' : ''}>
            Next →
          </button>
          <button class="btn btn-success btn-sm" id="saveBtn" disabled>
            Save
          </button>
          <button class="btn btn-outline-secondary btn-sm me-2" id="revertBtn" style="display: none;">
            Revert
          </button>
          <span id="statusMsg" class="ms-2 text-success" style="display:none; font-size: 0.85rem;"></span>
        </div>
      </div>
    </div>
  </div>
  
  <div class="container-fluid">
    ${itemsHTML}
  </div>
  
  <script id="toml-data" type="application/json">
    ${jsonData}
  </script>
  <script>
    (function() {
      // ===== NAVIGATION =====
      var currentIndex = 0;
      var totalItems = ${totalItems};
      var items = document.querySelectorAll('.comparison-item');
      var prevBtn = document.getElementById('prevBtn');
      var nextBtn = document.getElementById('nextBtn');
      var counter = document.getElementById('counter');

      function showItem(index) {
        items.forEach(function(item, i) {
          item.style.display = i === index ? 'block' : 'none';
        });
        counter.textContent = (index + 1) + ' / ' + totalItems;
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === totalItems - 1;
        currentIndex = index;
      }

      prevBtn.addEventListener('click', function() {
        if (currentIndex > 0) showItem(currentIndex - 1);
      });
      nextBtn.addEventListener('click', function() {
        if (currentIndex < totalItems - 1) showItem(currentIndex + 1);
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft' && currentIndex > 0) showItem(currentIndex - 1);
        else if (e.key === 'ArrowRight' && currentIndex < totalItems - 1) showItem(currentIndex + 1);
        else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          document.getElementById('saveBtn').click();
        }
      });

      // ===== DATA MODEL =====
      var tomlData = JSON.parse(document.getElementById('toml-data').textContent);
      var tomlPath = document.querySelector('meta[name="toml-path"]').content;
      var saveBtn = document.getElementById('saveBtn');
      var revertBtn = document.getElementById('revertBtn');
      var dirtyBadge = document.getElementById('dirtyBadge');
      var statusMsg = document.getElementById('statusMsg');
      var fileHandle = null;

      // ===== TOML SERIALIZER =====
      function escapeTomlString(s) {
        return s.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
      }

      function serializeTable(table) {
        var lines = [];
        var header = table.arrayIndex !== null
          ? '[[' + table.tableId + ']]'
          : '[' + table.tableId + ']';
        lines.push(header);

        var keys = Object.keys(table.fields);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          var val = table.fields[key];

          if (val === undefined || val === 'undefined' || val === null) {
            lines.push(key + ' = undefined');
          } else if (typeof val === 'boolean') {
            lines.push(key + ' = ' + val);
          } else if (typeof val === 'number') {
            lines.push(key + ' = ' + val);
          } else if (typeof val === 'string') {
            lines.push(key + ' = "' + escapeTomlString(val) + '"');
          } else {
            lines.push(key + ' = ' + JSON.stringify(val));
          }
        }
        return lines.join('\\n');
      }

      function serializeAll() {
        var groups = {};
        var order = [];
        for (var i = 0; i < tomlData.length; i++) {
          var t = tomlData[i];
          if (!groups[t.tableId]) {
            groups[t.tableId] = [];
            order.push(t.tableId);
          }
          groups[t.tableId].push(t);
        }

        var parts = [];
        for (var j = 0; j < order.length; j++) {
          var id = order[j];
          var tables = groups[id];
          for (var m = 0; m < tables.length; m++) {
            parts.push(serializeTable(tables[m]));
          }
        }
        return parts.join('\\n\\n') + '\\n';
      }

      // ===== COLLECT EDITS FROM DOM =====
      function collectEdits() {
        var inputs = document.querySelectorAll('[data-table][data-field]');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          var tableId = el.getAttribute('data-table');
          var field = el.getAttribute('data-field');
          var indexStr = el.getAttribute('data-index');
          var index = parseInt(indexStr, 10);

          var table = null;
          var matchCount = 0;
          for (var j = 0; j < tomlData.length; j++) {
            if (tomlData[j].tableId === tableId) {
              if (matchCount === index || (index === -1 && matchCount === 0)) {
                table = tomlData[j];
                break;
              }
              matchCount++;
            }
          }

          if (table) {
            var newVal = el.tagName === 'SELECT' ? el.value
              : el.type === 'number' ? (el.value === '' ? undefined : Number(el.value))
              : el.value || undefined;
            table.fields[field] = newVal;
          }
        }
      }

      // ===== DIRTY TRACKING =====
      var dirtyInputs = new Set();
      var isDirty = false;
      var savedValues = {};

      function snapshotOriginals() {
        var inputs = document.querySelectorAll('[data-table][data-field]');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          var key = el.getAttribute('data-table') + '|' +
                    el.getAttribute('data-index') + '|' +
                    el.getAttribute('data-field');
          savedValues[key] = el.value;
        }
      }

      function markDirty(el) {
        var key = el.getAttribute('data-table') + '|' +
                  el.getAttribute('data-index') + '|' +
                  el.getAttribute('data-field');
        var original = savedValues[key];
        var current = el.value;

        if (current !== original) {
          el.classList.add('is-dirty');
          dirtyInputs.add(key);
        } else {
          el.classList.remove('is-dirty');
          dirtyInputs.delete(key);
        }
        updateDirtyState();
      }

      function updateDirtyState() {
        isDirty = dirtyInputs.size > 0;
        saveBtn.disabled = !isDirty;
        dirtyBadge.style.display = isDirty ? 'inline' : 'none';
        revertBtn.style.display = isDirty ? 'inline-block' : 'none';
      }

      function attachDirtyListeners() {
        var inputs = document.querySelectorAll('[data-table][data-field]');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          el.addEventListener('input', function() { markDirty(this); });
          el.addEventListener('change', function() { markDirty(this); });
        }
      }

      // ===== REVERT =====
      revertBtn.addEventListener('click', function() {
        var inputs = document.querySelectorAll('[data-table][data-field]');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          var key = el.getAttribute('data-table') + '|' +
                    el.getAttribute('data-index') + '|' +
                    el.getAttribute('data-field');
          el.value = savedValues[key] || '';
          el.classList.remove('is-dirty');
        }
        dirtyInputs.clear();
        updateDirtyState();
      });

      // ===== BEFORE UNLOAD WARNING =====
      window.addEventListener('beforeunload', function(e) {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      });

      // ===== SAVE LOGIC =====
      function getFilename() {
        if (tomlPath) {
          var parts = tomlPath.replace(/\\\\/g, '/').split('/');
          return parts[parts.length - 1] || 'output.toml';
        }
        return 'corrected.toml';
      }

      async function saveToFileSystem(content) {
        try {
          if (!fileHandle) {
            var opts = {
              types: [{
                description: 'TOML files',
                accept: { 'text/toml': ['.toml'] }
              }],
              multiple: false
            };
            var filename = getFilename();
            if (filename) {
              opts.suggestedName = filename;
            }
            var handles = await window.showOpenFilePicker(opts);
            fileHandle = handles[0];
          }
          var writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          showStatus('Saved to ' + getFilename(), 'success');
        } catch (e) {
          if (e.name === 'AbortError') {
            return;
          }
          downloadFile(content);
          showStatus('Downloaded (save failed: ' + e.message + ')', 'warning');
        }
      }

      function downloadFile(content) {
        var blob = new Blob([content], { type: 'text/toml' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = getFilename();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('Downloaded ' + getFilename(), 'success');
      }

      function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = 'ms-2 text-' + (type || 'success');
        statusMsg.style.display = 'inline';
        clearTimeout(showStatus._timer);
        showStatus._timer = setTimeout(function() {
          statusMsg.style.display = 'none';
        }, 3000);
      }

      // ===== SAVE BUTTON HANDLER =====
      saveBtn.addEventListener('click', function() {
        collectEdits();
        var content = serializeAll();

        var savePromise;
        if ('showOpenFilePicker' in window) {
          savePromise = saveToFileSystem(content);
        } else {
          downloadFile(content);
          savePromise = Promise.resolve();
        }

        savePromise.then(function() {
          var dirtyEls = document.querySelectorAll('.is-dirty');
          for (var i = 0; i < dirtyEls.length; i++) {
            dirtyEls[i].classList.remove('is-dirty');
            dirtyEls[i].classList.add('is-saved');
          }
          dirtyInputs.clear();
          updateDirtyState();

          snapshotOriginals();

          setTimeout(function() {
            var saved = document.querySelectorAll('.is-saved');
            for (var j = 0; j < saved.length; j++) {
              saved[j].classList.remove('is-saved');
            }
          }, 1500);
        });
      });

      // ===== INITIALIZE =====
      showItem(0);
      snapshotOriginals();
      attachDirtyListeners();
    })();
  </script>
</body>
</html>`;
}
