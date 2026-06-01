import * as fs from 'fs';
import * as path from 'path';

interface SubtaskRecord {
  name: string;
  tokens: number;
  duration: number;
  retries: number;
  startTime: number;
}

interface StepRecord {
  name: string;
  tokens: number;
  duration: number;
  retries: number;
  tasks: number;
  subtasks: SubtaskRecord[];
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const msStr = `${String(s).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${msStr}`;
  return `${String(m).padStart(2, '0')}:${msStr}`;
}

export class Stats {
  private steps: Map<string, StepRecord> = new Map();
  private pendingSubtasks: Map<string, SubtaskRecord> = new Map();
  private currentStepName: string = '';
  private tokensBaseline: number = 0;
  private stepStartTime: number = 0;
  private stateLabel: string = '';

  beginStep(name: string, tokens: number): void {
    this.currentStepName = name;
    this.tokensBaseline = tokens;
    this.stepStartTime = Date.now();
    this.steps.set(name, {
      name,
      tokens: 0,
      duration: 0,
      retries: 0,
      tasks: 0,
      subtasks: [],
    });
  }

  endStep(name: string, tokens: number, retries: number, tasks: number): void {
    const rec = this.steps.get(name);
    if (!rec) return;
    rec.tokens = Math.max(0, tokens - this.tokensBaseline);
    rec.duration = Date.now() - this.stepStartTime;
    rec.retries = retries;
    rec.tasks = tasks;
  }

  beginSubtask(childID: string, name: string): void {
    this.pendingSubtasks.set(childID, {
      name,
      tokens: 0,
      duration: 0,
      retries: 0,
      startTime: Date.now(),
    });
  }

  endSubtask(childID: string, tokens: number, retries: number): void {
    const rec = this.pendingSubtasks.get(childID);
    if (!rec) return;
    rec.tokens = tokens;
    rec.duration = Date.now() - rec.startTime;
    rec.retries = retries;
    this.pendingSubtasks.delete(childID);

    const stepRec = this.steps.get(this.currentStepName);
    if (stepRec) {
      stepRec.subtasks.push({
        name: rec.name,
        tokens: rec.tokens,
        duration: rec.duration,
        retries: rec.retries,
        startTime: 0,
      });
    }
  }

  finalize(stateLabel: string): void {
    this.stateLabel = stateLabel;
  }

  write(
    workflow: string,
    jobPath: string,
    startTime: number,
    tokens: number,
    subtaskTokens: number
  ): void {
    const now = new Date();
    const lines: string[] = [];

    lines.push(`workflow = "${workflow}"`);
    lines.push(`job = "${path.basename(jobPath)}"`);
    lines.push(`state = "${this.stateLabel}"`);
    lines.push(`started_at = "${new Date(startTime).toISOString()}"`);
    lines.push(`ended_at = "${now.toISOString()}"`);
    const totalMs = now.getTime() - startTime;
    lines.push(`duration = "${fmtDuration(totalMs)}"`);
    lines.push(`milliseconds = ${totalMs}`);
    lines.push('');
    lines.push('[totals]');
    lines.push(`tokens = ${tokens}`);
    lines.push(`subtask_tokens = ${subtaskTokens}`);
    lines.push(`steps = ${this.steps.size}`);

    let totalTasks = 0;
    let totalRetries = 0;
    for (const rec of this.steps.values()) {
      totalTasks += rec.tasks;
      totalRetries += rec.retries;
      for (const sub of rec.subtasks) {
        totalRetries += sub.retries;
      }
    }
    lines.push(`tasks = ${totalTasks}`);
    lines.push(`retries = ${totalRetries}`);
    lines.push('');

    for (const rec of this.steps.values()) {
      lines.push('[[step]]');
      lines.push(`name = "${rec.name}"`);
      lines.push(`tokens = ${rec.tokens}`);
      lines.push(`duration = "${fmtDuration(rec.duration)}"`);
      lines.push(`milliseconds = ${rec.duration}`);
      lines.push(`retries = ${rec.retries}`);
      lines.push(`tasks = ${rec.tasks}`);

      if (rec.subtasks.length > 0) {
        for (const sub of rec.subtasks) {
          lines.push('');
          lines.push(`[[step.subtask]]`);
          lines.push(`name = "${sub.name}"`);
          lines.push(`tokens = ${sub.tokens}`);
          lines.push(`duration = "${fmtDuration(sub.duration)}"`);
            lines.push(`milliseconds = ${sub.duration}`);
          lines.push(`retries = ${sub.retries}`);
        }
      }
      lines.push('');
    }

    const outputPath = path.join(jobPath, 'stats.toml');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  }
}