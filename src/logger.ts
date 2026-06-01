import * as fs from "fs";
import * as path from "path";

let LOG_DIR = path.join(process.cwd(), ".logs");
let LOG_FILE = path.join(LOG_DIR, "orca2.log");

export function ensureInitialized(basePath?: string): void {
  if(basePath) {
    LOG_DIR = basePath;
    LOG_FILE = path.join(LOG_DIR, "orca2.log");
  }
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function log(...args: unknown[]) {
  ensureInitialized();

  const timestamp = formatTimestamp();
  const message = args
    .map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)))
    .join(" ");
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

export function clearLog() {
  fs.writeFileSync(LOG_FILE, "");
}
