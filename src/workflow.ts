import * as path from 'path';
import { log } from './logger.js';
import { Step, StepState } from './step.js';
import { Variables } from './variables.js';
import { parseWorkflowTOML, ParseError } from './toml-parser.js';
import { Machine, NumberSetter, State, Status } from './types.js';
import { Stats } from './stats.js';
import { Subtask } from './subtask.js';
import { TaskState } from './task.js';

export class Workflow {
  private workflowName: string;
  private job: string;
  private processName: string;
  private basePath?: string;

  description: string = 'Orca2 workflow';
  retry: number = 3;
  debug: boolean = false;
  single_file: boolean = false;
  stats: boolean = false;
  cancel_threshold: number = 5;
  steps: Step[] = [];

  constructor(workflowName: string, job: string, processName: string, basePath?: string) {
    this.workflowName = workflowName;
    this.job = job;
    this.processName = processName;
    this.basePath = basePath;
  }

  get name(): string { return this.workflowName; }

  step(index: number): Step | null {
    if (index >= 0 && index < this.steps.length) {
      return this.steps[index];
    }
    return null;
  }

  stepName(index: number): string {
    const step = this.step(index);
    return step ? step.name : 'undefined';
  }

  stepDescription(index: number): string {
    const step = this.step(index);
    if(step) {
      const variables = this.variables();
      variables.setStep(step.name, step.output);
      return variables.substitute(step.description, false, true);
    }
    return 'undefined';
  }

  get path(): string {
    const fileName = `${this.workflowName}.toml`;
    return this.basePath ? path.join(this.basePath, fileName) : path.join(process.cwd(), 'workflow', fileName);
  }

  get jobPath(): string {
    const jobDir = this.single_file ? this.job : path.join('thoughts', this.job);    
    return this.basePath ? path.join(this.basePath, jobDir) : path.join(process.cwd(), jobDir);
  }

  variables(): Variables {
    return new Variables(this.basePath ? this.basePath : process.cwd(), this.jobPath, this.workflowName, this.processName);
  }

  load(setCurrentStep: NumberSetter): ParseError | null {
    const result = parseWorkflowTOML(this.workflowName, this.basePath);
    if (result instanceof ParseError) return result;

    const { config } = result;
    this.description = config.description;
    this.retry = config.retry ?? 3;
    this.debug = config.debug ?? false;
    this.single_file = config.single_file ?? false;
    this.stats = config.stats ?? false;

    this.steps = config.step.map(s => Step.fromConfig(s, this.retry, this.workflowName, this.basePath));

    const variables = this.variables();
    const length = this.steps.length;
    this.trace(`Walking back ${length} steps`);
    for (let i = length; i > 0; i--) {
      const idx = i - 1;
      const step = this.steps[idx];
      if (step.isComplete(variables)) {
        this.trace(`Skipping: step ${idx + 1} ${step.name} is already complete`);
        if (i === length) {
          setCurrentStep(-1);
        } else {
          setCurrentStep(i);
        }
        return null;
      }
      this.trace(`Found: step ${idx + 1} ${step.name} is incomplete`);
    }
    setCurrentStep(0);
    return null;
  }
 
  firstPrompt(): string | null {
    this.info('First prompt returning "Hello"');
    return 'Hello';
  }

  nextPrompt(currentStep: number, currentTask: number, resumed: boolean): string | null {
    const step = this.step(currentStep);
    if (!step) {
      this.warn(`No step found at index ${currentStep + 1}`);
      return null;
    }
    const variables = this.variables();
    return step.buildPrompt(variables, this.workflowName, currentTask, resumed);
  }

  private log(level: string, message: string) {
    log(level, this.name, message);
  }

  info(message: string) { this.log('INFO', message); }

  trace(message: string) {
    if (this.debug) this.log('DEBUG', message);
  }

  warn(message: string) { this.log('WARN', message); }

  error(message: string) { this.log('ERROR', message); }

  logErr(err: ParseError) {
    log('ERROR', this.name, err.title, err.message);
  }
}

export class WorkflowState {
  sessionID: string;
  workflow: Workflow;
  steps: StepState[] = [];
  currentStep: number = 0;
  state: State = State.FIRST;

  // Track timing for cancellation detection
  lastRetryTimestamp: number = 0;
  lastEpoc = 1;
  checkpoint: string | null = null;

  startTime: number;
  tokens: number = 0;
  subtaskTokens: number = 0;

  stats: Stats | null = null;

  constructor(sessionID: string, workflow: string, job: string, process?: string, basePath?: string) {
      this.sessionID = sessionID;
      this.workflow = new Workflow(workflow, job, process ?? 'undefined', basePath);
      this.startTime = Date.now();
  }

  setCurrentStep(currentStep: number) {
      this.currentStep = currentStep;
  }

  get step(): Step | null {
    return this.workflow.step(this.currentStep);
  }

  get stepName(): string | null {
    return this.workflow.stepName(this.currentStep);
  }

  get stepDescription(): string | null {
    return this.workflow.stepDescription(this.currentStep);
  }

  get stepState(): StepState | null {
    if(this.currentStep >= 0 && this.currentStep < this.steps.length) {
      return this.steps[this.currentStep];
    }
    return null;
  }

  get resumed() : boolean {
    // First steps are always resumed
    if (this.state === State.FIRST) return true;
    // Subtask and Parallel steps always require full prompts
    const step = this.step;
    if(step && (step.subtask || step.parallel)) return true;
    // All other steps are assumed to be sequential
    return false;
  }

  get cancelled(): boolean {
    return this.state == State.CANCELLED;
  }

  get subtask(): boolean {
    const step = this.step;
    return step ? step.subtask : false;
  }

  get parallel(): boolean {
    const step = this.step;
    return step ? step.parallel : false;
  }

  get epoc(): number {
    return this.lastEpoc;
  }

  nextEpoc(): number {
    return ++this.lastEpoc;
  }

  load(): ParseError | null {
      const err = this.workflow.load((currentStep: number) => this.setCurrentStep(currentStep));
      if (err == null) {
        for(let i = 0; i < this.workflow.steps.length; i++) {
          this.steps.push(new StepState());
        }
        if (this.workflow.stats) {
          this.stats = new Stats();
        }
        this.workflow.info(`Workflow loaded with ${this.workflow.steps.length} steps`);
      }
      return err;
  }

  stepMachine(): Machine | null {
    const step = this.step;
    return step ? step.machine : null;
  }

  stepStatus(): Status | null {
    if (this.currentStep < 0 || this.currentStep >= this.steps.length) {
      this.workflow.warn(`Current step index ${this.currentStep + 1} is out of bounds`);
      return null;
    }
    return this.steps[this.currentStep].status;
  }

  taskStatus(task: number): Status | null {
    if (this.currentStep < 0 || this.currentStep >= this.steps.length) {
      this.workflow.warn(`Current step index ${this.currentStep + 1} is out of bounds`);
      return null;
    }
    const step = this.steps[this.currentStep];
    return step.taskStatus(task);
  }

  private async transition(step: Step): Promise<State> {
    if(this.state === State.FIRST) {
      this.stats?.beginStep(step.name, this.tokens);
    }
    if (step.dialog) {
      // Send first prompt while PENDING, then transition to PAUSED to wait for user input
      this.state = this.state === State.NEXT ? State.PAUSED : State.NEXT;
    } else if(step.subtask || step.parallel) {
      // For subtask and parallel steps, transition to NEXT to send all prompts immediately
      this.state = State.NEXT;
    } else {
      // For non-dialog sequential steps, transition to CONTINUE to send "Please Continue" if session is idle
      this.state = this.state === State.NEXT ? State.CONTINUE : State.NEXT;
    }
    // Update cancel threshold
    this.lastRetryTimestamp = Date.now();
    return this.state;
  }

  private async advance(step: Step, retries: number): Promise<State> {
    this.stats?.endStep(step.name, this.tokens, retries, step.tasks.length);
    const workflow = this.workflow;
    this.currentStep++;
    const next = this.workflow.step(this.currentStep);
    if (!next ||this.currentStep >= this.steps.length) {
      workflow.trace(`All steps done`);
      this.currentStep = -1;
      this.state = State.DONE;
      return this.state;
    }
    this.stats?.beginStep(next.name, this.tokens);
    workflow.trace(`Advancing to step '${next.name}'`);
    // Set state to CONTINUE to automatically transition
    // - dialog: NEXT -> PAUSED to wait for user input, then CONTINUE on next transition
    // - subtask/parallel: NEXT -> NEXT to send next prompts immediately
    // - sequential: NEXT -> CONTINUE to trigger "Please Continue" when session idle
    this.state = State.CONTINUE;
    return await this.transition(next);
  }

  async update(): Promise<State> {
    const workflow = this.workflow;
    if (this.currentStep < 0) {
      workflow.trace('Workflow done');
      this.state = State.DONE;
      return this.state;
    }
    const step = this.step;
    if(!step) {
      this.state = State.ERROR;
      return this.state;
    }
    const stepState = this.steps[this.currentStep];
    const variables = workflow.variables();
    const status = stepState.update(step, variables);

    workflow.trace(`state=${State[this.state]} machine=${Machine[step.machine]} status=${Status[status]}`);

    switch(step.machine) {
      case Machine.STEP:
        switch(status) {
          case Status.PENDING:
          case Status.RETRY:
            return await this.transition(step);
          case Status.SUBTASK_COMPLETE:
          case Status.STEP_DONE:
            return await this.advance(step, stepState.retry);
          case Status.HALT:
            workflow.trace(`Step '${step.name}' error — retries exhausted`);
            this.state = State.ERROR;
        }
        break;
      case Machine.GENERATE:
        switch(status) {
          case Status.PENDING:
          case Status.RETRY:
            return await this.transition(step);
          case Status.SUBTASK_COMPLETE:
          case Status.STEP_DONE:
            step.end(variables);
            return await this.advance(step, stepState.retry);
          case Status.HALT:
            workflow.trace(`Generate step '${step.name}' error — retries exhausted`);
            this.state = State.ERROR;
        }
        break;
      case Machine.ITERATE:
        switch(status) {
          case Status.PENDING:
          case Status.RETRY:
          case Status.SUBTASK_COMPLETE:
            return await this.transition(step);
          case Status.STEP_DONE:
            step.end(variables);
            return await this.advance(step, stepState.retry);
          case Status.HALT:
            workflow.trace(`Iterate step '${step.name}' error — retries exhausted`);
            this.state = State.ERROR;
        }
        break;
      case Machine.WHILE:
        switch(status) {
          case Status.PENDING:
          case Status.RETRY:
          // @ts-ignore - intentional fallthrough
          case Status.SUBTASK_COMPLETE:
            if (step.loop) {
              const loopTarget = workflow.steps.findIndex(s => s.name === step.loop);
              if (loopTarget < 0) {
                workflow.error(`Loop target '${step.loop}' not found`);
                this.state = State.ERROR;
                break;
              }
              this.currentStep = loopTarget;
              const loop = this.step;
              if(!loop) {
                this.state = State.ERROR;
                return this.state;
              }
              workflow.trace(`Looping to step '${loop.name}'`);
              return await this.transition(loop);
            }
          case Status.STEP_DONE:
            step.end(variables);
            return await this.advance(step, stepState.retry);
          case Status.HALT:
            workflow.trace(`While step '${step.name}' error — retries exhausted`);
            this.state = State.ERROR;
        }
        break;
      case Machine.PROCESS:
        switch(status) {
          case Status.PENDING:
          case Status.RETRY:
          case Status.SUBTASK_COMPLETE:
            return await this.transition(step);
          case Status.STEP_DONE:
            step.end(variables);
            return await this.advance(step, stepState.retry);
          case Status.HALT:
            workflow.trace(`Process step '${step.name}' error — retries exhausted`);
            this.state = State.ERROR;
        }
        break;
    }
    return this.state;
  }

  build(resumed: boolean): Subtask[] {
    // Check if workflow ended
    if(this.currentStep < 0) return [];
    const subtasks: Subtask[] = [];
    const machine = this.stepMachine();
    const workflow = this.workflow;
    const step = workflow.step(this.currentStep);
    const stepState = this.stepState;
    if(!step || !stepState) {
        log('WARN', `Current step state is null`);
    } else if(machine === Machine.STEP || machine === Machine.GENERATE) {
      const prompt = workflow.nextPrompt(this.currentStep, 0, resumed);
      if(prompt?.trim()) {
        const subtask = new Subtask(step.name, 0, prompt, stepState.output, (increment: boolean) => stepState.retryCounter(increment));
        subtasks.push(subtask);
      } else if (machine === Machine.STEP) {
        log('WARN', `Step '${step?.name}' prompt is empty`);
      } else {
        log('WARN', `Step '${step?.name}' generate prompt is empty`);
      }
    } else {
      // Ensure tasks are loaded before building subtasks
      const variables = workflow.variables();
      if (step.tasks.length === 0) {
        step.loadTasks(variables);
      }
      // Ensure stepState.tasks is populated to match step.tasks
      // This handles the case where we've just advanced to a new step
      if (stepState.tasks.length === 0 && step.tasks.length > 0) {
        for (let i = 0; i < step.tasks.length; i++) {
          stepState.tasks.push(new TaskState());
        }
      }
      for (let currentTask = 0; currentTask < step.tasks.length && currentTask < stepState.tasks.length; currentTask++) {
        const task = step.tasks[currentTask];
        const taskState = stepState.tasks[currentTask];
        if (taskState.status === Status.SUBTASK_COMPLETE) {
          continue;
        }
        const prompt = workflow.nextPrompt(this.currentStep, currentTask, resumed);
        if(prompt?.trim()) {
          const subtask = new Subtask(task.each, task.index, prompt,  task.output, (increment: boolean) => taskState.retryCounter(increment));
          subtasks.push(subtask);
        } else if(machine === Machine.PROCESS) {
            log('WARN', `Step '${step.name}' process '${task.each}' prompt is empty`);
            continue;
        } else {
            log('WARN', `Step '${step.name}' task '${task.each}' prompt is empty`);
            continue;
        }
        // Only return the current subtask
        if(!this.parallel) {
          break;
        }
      }
    }
    return subtasks;
  }
}