import * as fs from 'fs';
import * as path from 'path';
import { log } from './logger.js';

export class Variables {
  readonly projectPath: string;
  readonly jobPath: string;
  readonly jobName: string;
  readonly workflowName: string;
  readonly processName?: string;

  private stepName?: string;
  private stepPath?: string;
  private stepOutput?: string;
  private each?: string;
  private index: number = 0; // 1-based index for better readability in prompts
  private taskInput?: string;
  private taskOutput?: string;
  private processMode: boolean = false;

  constructor(projectPath: string, jobPath: string, workflowName: string, processName?: string) {
    this.projectPath = projectPath;
    this.jobPath = jobPath;
    this.jobName = path.basename(jobPath);
    this.workflowName = workflowName;
    this.processName = processName;
    this.stepPath = jobPath;
  }

  get input(): string | null {
    if(this.index > 0 && this.taskInput) return this.taskInput;
    return null;
  }

  get output(): string | null {
    if(this.index > 0 && this.taskOutput) return this.taskOutput;
    if (this.stepOutput) return this.stepOutput;
    return null;
  }

  setStep(name: string, output?: string) {
    this.stepName = name;
    this.stepPath = this.jobPath;
    if (output) {
      this.stepOutput = this.resolve(output) ?? 'undefined';
    } else {
      this.stepOutput = 'undefined';
    }
    this.clearTask();
  }

  setTask(each: string, index: number, input?: string, output?: string) {
    this.each = each;
    this.index = index;
    if (input) {
      this.taskInput = this.resolve(input) ?? 'undefined';
    } else {
      this.taskInput = undefined;
    }
    if(this.stepName) {
      this.stepPath = path.join(this.jobPath, this.stepName);
    }
    if (output) {
      this.taskOutput = this.resolve(output) ?? 'undefined';
    } else {
      this.taskOutput = undefined;
    }
    this.stepPath = this.jobPath;
  }

  setProcess(each: string, index: number, output?: string): void {
    this.processMode = true;
    this.each = each;
    this.index = index;
    if(this.stepName) {
      this.stepPath = path.join(this.jobPath, this.stepName);
    }
    if (output) {
      this.taskOutput = this.resolve(output) ?? 'undefined';
    } else {
      this.taskOutput = undefined;
    }
    // Switch back to step path for loading input prompts
    this.stepPath = this.jobPath;
  }

  clearTask(): void {
    this.stepPath = this.jobPath;
    this.each = undefined;
    this.index = 0;
    this.processMode = false;
    this.taskInput = undefined;
    this.taskOutput = undefined;
  }

  get process(): string | null {
    if(!this.processName) return null;
    if(this.processName.startsWith('~/') || this.processName.startsWith('./')) return this.resolve(this.processName);
    return path.join(this.projectPath, 'process', this.processName);
  }

  substitute(text: string, sanitize = false, relative = false): string {
    const projectPath = relative ? '.' : sanitize ? sanitizePath(this.projectPath) : this.projectPath;
    const jobPath = relative ? this.relativize(sanitize ? sanitizePath(this.jobPath) : this.jobPath) : sanitize ? sanitizePath(this.jobPath) : this.jobPath;
    const job = sanitize ? sanitizePath(this.jobName) : this.jobName;
    const workflow = sanitize ? sanitizePath(this.workflowName) : this.workflowName;
    const process = this.processName ? relative ? this.relativize(sanitize ? sanitizePath(this.processName) : this.processName) : sanitize ? sanitizePath(this.processName) : this.processName : 'undefined';
    const step = this.stepName ? sanitize ? sanitizePath(this.stepName) : this.stepName : 'undefined';
    const input = this.input ? relative ? this.relativize(sanitize ? sanitizePath(this.input) : this.input) : sanitize ? sanitizePath(this.input) : this.input : 'undefined';
    const output = this.output ? relative ? this.relativize(sanitize ? sanitizePath(this.output) : this.output) : sanitize ? sanitizePath(this.output) : this.output : 'undefined';
    const each = this.each ? sanitize ? sanitizePath(this.each) : this.each : 'undefined'
    let result = text;
    result = result.replace(/\$PROJECT_PATH/g, projectPath);
    result = result.replace(/\$JOB_PATH/g, jobPath);
    result = result.replace(/\$JOB/g, job);
    result = result.replace(/\$WORKFLOW/g, workflow);
    result = result.replace(/\$PROCESS/g, process);
    result = result.replace(/\$STEP/g, step);
    result = result.replace(/\$INPUT/g, input);
    result = result.replace(/\$OUTPUT/g, output);
    result = result.replace(/\$EACH/g, each);
    result = result.replace(/\$INDEX/g, this.index > 0 ? String(this.index) : '0');
    return result;
  }

  private relativize(absPath: string): string {
    if (absPath.startsWith(this.projectPath + '/')) {
      return absPath.substring(this.projectPath.length + 1);
    }
    if (absPath === this.projectPath) {
      return '.';
    }
    return absPath;
  }

  resolve(fileText: string): string | null {
    let resolved = this.substitute(fileText, true);

    if (resolved.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.HOMEPATH;
      if (!homeDir) return resolved;
      const cleanPath = resolved.substring(2);
      const fullPath = path.resolve(homeDir, cleanPath);
      const normalized = path.normalize(fullPath);
      const normalizedHome = path.normalize(homeDir);
      if (!normalized.startsWith(normalizedHome + path.sep) && normalized !== normalizedHome) {
        return resolved;
      }
      return normalized;
    }

    // Disallow absolute paths for security reasons
    if (path.isAbsolute(resolved)) {
      return null;
    }

    if (resolved.startsWith('./')) {
      return path.resolve(this.projectPath, resolved.substring(2));
    }

    return this.stepPath ? path.resolve(this.stepPath, resolved) : null;
  }

  exists(fileText: string): boolean {
    const resolved = this.resolve(fileText);
    return resolved ? fs.existsSync(resolved) : false;
  }

  load(fileText: string, warn: boolean): string | null {
    const resolved = path.isAbsolute(fileText) ? fileText : this.resolve(fileText);
    if (!resolved || !fs.existsSync(resolved)) {
      if(warn) log('WARN', `File '${fileText}' not found`);
      return null;
    }
    try {
      //log('INFO', `Loading file '${resolved}'...`);
      const content = fs.readFileSync(resolved, 'utf-8');
      return this.substitute(content, false, true);
    } catch {
      log('WARN', `Failed to read file '${fileText}'`);
      return null;
    }
  }

  buildPrompt(workflow: string, step: string, prompt: string[], fullPrompt: boolean): string {
    if(fullPrompt) log('INFO', `Building full prompt for workflow '${workflow}', step '${step}' with ${prompt.length} additional prompts...`);
    const parts: string[] = [];

    // Add workflow context (optional)
    // e.g. <project>/workflow/<workflow>.md
    if (fullPrompt) {
      const workflowContext = this.load(`./workflow/${workflow}.md`, false);
      if (workflowContext?.trim()) parts.push(workflowContext);
    }
  
    // Add step instructions (should exist)
    // e.g. <project>/workflow/<workflow>/<step>.md
    const stepInstructions = this.load(`./workflow/${workflow}/${step}.md`, true);
    if (stepInstructions?.trim()) parts.push(stepInstructions);

    // Add process instructions if in process mode (should exist)
    // e.g. <project>/process/<process>/<each>.md
    if (this.processMode && this.processName) {
      if(this.each) {
        const processPrompt = this.load(`./process/${this.processName}/${this.each}.md`, true);
        if (processPrompt?.trim()) parts.push(processPrompt);
      }
      // Add general process prompt (optional)
      const processInstructions = this.load(`./process/${this.processName}.md`, false);
      if (processInstructions?.trim()) parts.push(processInstructions);
    }

    // Add subtask input prompt (should exist) 
    // e.g. <project>/<job>/<input>
    if (this.index > 0 && this.input) {
      const taskPrompt = this.load(this.input, true);
      if (taskPrompt?.trim()) parts.push(taskPrompt);
    }

    // Add step prompts (should exist)
    // e.g. <project>/<job>/<prompt>
    if (fullPrompt) {
      for (const filename of prompt) {
        const content = this.load(filename, true);
        // Skip missing prompts and empty files
        if(content?.trim()) parts.push(content);
      }
    }

    return parts.join('\n');
  }
}

function sanitizePath(s: string): string {
  if (!s) return '';
  return s
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^\w._\-\/]/g, '_')
    .substring(0, 255);
}