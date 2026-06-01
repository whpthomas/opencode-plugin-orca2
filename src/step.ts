import * as fs from 'fs';
import * as path from 'path';
import type { TOMLStepConfig } from './types.js';
import { Variables } from './variables.js';
import { log } from './logger.js';
import { Task, TaskState } from './task.js';
import { Machine, Status } from './types.js';

export class Step {
  readonly name: string;
  readonly description: string;
  readonly promptPath: string;
  readonly prompt: string[];
  readonly input?: string;
  readonly output?: string;
  readonly generate: boolean;
  readonly retry: number;
  readonly dialog: boolean;
  readonly HITL: boolean;
  readonly sequential: boolean;
  readonly parallel: boolean;
  readonly iterate?: string;
  readonly while?: string;
  readonly loop?: string;
  readonly process: boolean;
  readonly concatenate?: string;

  readonly machine: Machine;
  tasks: Task[] = [];

  constructor(
    name: string,
    description: string,
    promptPath: string,
    opts: {
      prompt?: string[];
      input?: string;
      output?: string;
      generate?: boolean;
      retry?: number;
      dialog?: boolean;
      HITL?: boolean;
      sequential?: boolean;
      parallel?: boolean;
      iterate?: string;
      while?: string;
      loop?: string;
      process?: boolean;
      concatenate?: string;
    } = {}
  ) {
    this.name = name;
    this.description = description;
    this.promptPath = promptPath;
    this.prompt = opts.prompt ?? [];
    this.input = opts.input;
    this.output = opts.output;
    this.generate = opts.generate ?? false;
    this.retry = opts.retry ?? 3;
    this.dialog = opts.dialog ?? false;
    this.HITL = opts.HITL ?? false;
    this.sequential = opts.sequential ?? false;
    this.parallel = opts.parallel ?? false;
    this.iterate = opts.iterate;
    this.while = opts.while;
    this.loop = opts.loop;
    this.process = opts.process ?? false;;
    this.concatenate = opts.concatenate;
    if (this.iterate) {
      this.machine = Machine.ITERATE;
    } else if (this.while) {
      this.machine = Machine.WHILE;
    } else if (this.process) {
      this.machine = Machine.PROCESS;
    } else if (this.generate) {
      this.machine = Machine.GENERATE;
    } else {
      this.machine = Machine.STEP;
    }
  }

  static fromConfig(config: TOMLStepConfig, defaultRetry: number = 3, workflowName: string, basePath?: string): Step {
    const filePath = path.join(workflowName, `${config.name}.md`);
    const promptPath = basePath ? path.join(basePath, filePath) : path.join(process.cwd(), 'workflow', filePath);
    return new Step(config.name, config.description, promptPath, {
      prompt: config.prompt,
      input: config.input,
      output: config.output,
      generate: config.generate,
      retry: config.retry ?? defaultRetry,
      dialog: config.dialog,
      HITL: config.HITL,
      sequential: config.sequential,
      parallel: config.parallel,
      iterate: config.iterate,
      while: config.while,
      loop: config.loop,
      process: config.process,
      concatenate: config.concatenate,
    });
  }

  isComplete(variables: Variables): boolean {
    if (!this.output) {
      log('WARN', `Step '${this.name}' has no output, considered complete`);
      return true;
    }
    variables.setStep(this.name, this.output);
    // For simple steps without $EACH, check if output exists
    if (this.machine === Machine.STEP) {
      return variables.exists(this.output);
    }
    // For iteration, while or process steps, check if all tasks are complete
    const entries = this.entries(variables);
    if(entries.length === 0) {
      return false;
    // If entries and machine is GENERATE,
    // consider step complete to trigger generation
    } else if (this.machine === Machine.GENERATE) {
      return true;
    }
    // Check each task output exists
    for (let i = 0; i < entries.length; i++) {
      const each = entries[i];
      const index = i + 1;
      // Resolved output path
      // e.g. <job>/<step>/<output> with $EACH and $INDEX substituted
      variables.setTask(each, index, this.input, this.output);
      if (!variables.output || !fs.existsSync(variables.output)) {
        return false;
      }
    }
    return true;
  }

  /// Get machine path directory
  private pathDir(variables: Variables): string | null {
    switch (this.machine) {
      case Machine.ITERATE:
        // <job>/<iterate>/*
        return this.iterate ? variables.resolve(this.iterate) : null;
      case Machine.WHILE:
        // <job>/<while>/*
        return this.while ? variables.resolve(this.while) : null;
      case Machine.PROCESS:
        // <project>/process/<process>/*
        return variables.process;
      default:
        // <job>/<step>/*
        return variables.resolve(this.name);
      }
  }

  /// Get $EACH file name for task generation
  private entries(variables: Variables): string[] {
    const pathDir = this.pathDir(variables);
    if (!pathDir || !fs.existsSync(pathDir)) return [];

    let entries: string[];
    try {
      entries = fs.readdirSync(pathDir);
    } catch {
      return [];
    }
    // sort in ascending order with numeric support, e.g. file2 before file10
    entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    // return file names without extensions for variable substitution
    return entries.map(entry => path.basename(entry, path.extname(entry)));
  }

  /// Called by StepState to load tasks based on current variables for ITERATE, WHILE or PROCESS steps
  loadTasks(variables: Variables) {
    if (!this.output) {
      log('WARN', `Step '${this.name}' has no output, cannot set tasks`);
      return;
    }
    const entries = this.entries(variables);
    this.tasks = [];
    for (let i = 0; i < entries.length; i++) {
      const each = entries[i];
      const index = i + 1;
      // Resolved output path
      // e.g. <job>/<step>/<output> with $EACH and $INDEX substituted
      variables.setTask(each, index, this.input, this.output);
      if (!variables.output) {
        log('WARN', `Step '${this.name}' task '${each}' has no output, cannot add task`);
        continue;
      }
      this.tasks.push(new Task(
        // $OUTPUT for task variable substitution
        variables.output,
        // $EACH for task variable substitution
        each,
        // $INDEX for task variable substitution
        index
      ));
    }
    variables.clearTask();
  }

  buildPrompt(variables: Variables, workflow: string, currentTask: number, firstPrompt: boolean): string | null {
    variables.setStep(this.name, this.output);

    // For simple steps without $EACH, check if output exists
    if (this.machine === Machine.STEP) {
      const prompt = variables.buildPrompt(workflow, this.name, this.prompt, !this.sequential || firstPrompt);
      if (prompt.trim()) {
        return prompt;
      }
      log('WARN', `Step '${this.name}' prompt is empty`);
      return null;
    }

    if (this.machine === Machine.GENERATE) {
      const prompt = variables.buildPrompt(workflow, this.name, this.prompt, !this.sequential || firstPrompt);
      if (prompt.trim()) {
        return prompt;
      }
      log('WARN', `Step '${this.name}' generate prompt is empty`);
      return null;
    }

    if (currentTask < 0 || currentTask >= this.tasks.length) {
      log('WARN', `Step '${this.name}' task ${currentTask + 1} exceeds task count ${this.tasks.length}`);
      return null;
    }
  
    const task = this.tasks[currentTask];
    if (this.machine === Machine.PROCESS) {
      variables.setProcess(task.each, task.index, this.output);
      const prompt = variables.buildPrompt(workflow, this.name, this.prompt, true);
      if (prompt.trim()) {
        return prompt;
      }
      log('WARN', `Step '${this.name}' process '${task.each}' prompt is empty`);
      return null;
    }

    // ITERATE or WHILE steps
    variables.setTask(task.each, task.index, this.input, this.output);
    const prompt = variables.buildPrompt(workflow, this.name, this.prompt, true);
    if (prompt.trim()) {
      return prompt;
    }
    log('WARN', `Step '${this.name}' task '${task.each}' prompt is empty`);
    return null;
  }

  cat(variables: Variables): boolean {
    if (!this.concatenate || !this.output) {
      log('WARN', `Step '${this.name}' has no concatenate or output defined, cannot concatenate`);
      return false;
    }
    const pathDir = variables.resolve(this.name);
    if (!pathDir || !fs.existsSync(pathDir)) {
      log('WARN', `Concatenate '${this.name}' output directory not found`);
      return false;
    }
    const resolvedOutput = variables.resolve(this.concatenate);
    if (!resolvedOutput) {
      log('WARN', `Concatenate '${this.name}' output path not found`);
      return false;
    }
    log('INFO', `Concatenate '${this.name}' outputs to '${resolvedOutput}'...`);
    let entries: string[];
    try {
      entries = fs.readdirSync(pathDir);
    } catch {
      log('WARN', `Concatenate '${this.name}' output directory not readable`);
      return false;
    }
    // sort in ascending order with numeric support, e.g. file2 before file10
    entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let parts: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const filename = entries[i];
      const each = path.basename(filename, path.extname(filename));
      const index = i + 1;
      // Resolved output path
      // e.g. <job>/<step>/<template> with $EACH and $INDEX substituted
      variables.setTask(each, index, this.input, this.output);
      const resolved = variables.output;
      if (resolved && fs.existsSync(resolved)) {
        try {
          parts.push(fs.readFileSync(resolved, 'utf-8'));
        } catch {
          parts.push(`# ${each || 'Output'} - ERROR`);
        }
      } else {
        parts.push(`# ${each || 'Output'} - MISSING`);
      }
    }
    variables.clearTask();
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    try {
      fs.writeFileSync(resolvedOutput, parts.join('\n\n'), 'utf-8');
      return true;
    } catch {
      log('WARN', `Failed to write concatenated output for step '${this.name}'`);
      return false;
    }
  }

  end(variables: Variables): boolean {
    if (this.concatenate) {
      return this.cat(variables);
    }
    return true;
  }
}

export class StepState {
  currentTask: number = 0;
  retry: number = 0;
  tasks: TaskState[] = [];
  status: Status = Status.PENDING;

  taskStatus(task: number): Status {
    if (task < 0 || task >= this.tasks.length) {
      log('WARN', `Task ${task + 1} exceeds task count ${this.tasks.length}`);
      return Status.HALT;
    }
    return this.tasks[task].status;
  }

  update(step: Step, variables: Variables): Status {
    if (!step.output) {
      this.status = Status.STEP_DONE;
      log('WARN', `Step '${step.name}' has no output, considered complete`);
      return this.status;
    }
    variables.setStep(step.name, step.output);

    if(step.machine === Machine.STEP) {
      // Check if step output exists
      if(variables.exists(step.output)) {
        this.status = Status.STEP_DONE;
        return this.status;
      }
      // If dialog is enabled, allow retries without limit to keep conversation going
      if(step.dialog) {
        this.status = Status.RETRY;
        return this.status;
      }
      if(this.retry >= step.retry) {
          log('WARN', `Step '${step.name}' retry count exceeded (${this.retry}/${step.retry}), halting...`);
          this.status = Status.HALT;
          return this.status;
      }
      this.retry++;
      this.status = Status.RETRY;
      return this.status;
    }

    if(step.machine === Machine.GENERATE) {
      const outputDir = path.join(variables.jobPath, step.name);
      if (!fs.existsSync(outputDir)) {
        this.status = Status.PENDING;
        return this.status;
      }
      // Check if any files exist in output directory to consider generate step complete
      let outputEntries: string[];
      try {
        outputEntries = fs.readdirSync(outputDir);
      } catch {
        log('WARN', `Step '${step.name}' output directory not readable`);
        this.status = Status.RETRY;
        return this.status;
      }
      if (outputEntries.length) {
        this.status = Status.STEP_DONE;
        return this.status;
      }
      // If dialog is enabled, allow retries without limit to keep conversation going
      if(step.dialog) {
        this.status = Status.RETRY;
        return this.status;
      }
      if(this.retry >= step.retry) {
          log('WARN', `Step '${step.name}' retry count exceeded (${this.retry}/${step.retry}), halting...`);
          this.status = Status.HALT;
          return this.status;
      }
      this.retry++;
      this.status = Status.RETRY;
      return this.status;
    }

    // For ITERATE, WHILE or PROCESS steps, load tasks based on current variables
    step.loadTasks(variables);

    // If no tasks, consider step pending to trigger prompt and task generation
    if (step.tasks.length === 0) {
      this.status = Status.PENDING;
      return this.status;
    }

    // Initialize or reset task states based on current tasks
    for (let i = 0; i < step.tasks.length; i++) {
      if (i >= this.tasks.length) {
        this.tasks.push(new TaskState());
      } else {
        this.tasks[i].reset();
      }
    }

    // Check each task status and update step status accordingly
    let currentTask = -1;
    let completed = 0;
    for (let i = 0; i < step.tasks.length; i++) {
      const task = step.tasks[i];
      const taskState = this.tasks[i];
      const status = taskState.update(step.retry, task.output);
      switch (status) {
        case Status.RETRY:
          if(currentTask < 0) {
            currentTask = task.index;
          }
          break;
        case Status.SUBTASK_COMPLETE:
          completed++;
          break;
        case Status.HALT:
          if(step.HITL) {
            log('INFO', `Step '${step.name}' task '${task.each}' retry count exceeded (${taskState.retry}/${step.retry}), HITL enabled, halting for manual intervention...`);
            this.status = Status.HALT;
            return this.status;
          }
          completed++;
          break;
      }
    }

    if (completed == this.tasks.length) {
      this.status = Status.STEP_DONE;
    }
    else if(step.parallel) {
      if(this.retry >= step.retry) {
          log('WARN', `Step '${step.name}' retry count exceeded (${this.retry}/${step.retry}), halting...`);
          this.status = Status.HALT;
      } else {
        this.retry++;
        this.status = Status.RETRY;
      }
    } else if(this.currentTask !== currentTask) {
      this.currentTask = currentTask;
      this.status = Status.SUBTASK_COMPLETE;
    } else {
      this.status = Status.RETRY;
    }
    return this.status;
  }
}
