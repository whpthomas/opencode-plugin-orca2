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
