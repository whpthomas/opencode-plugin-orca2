export interface TOMLStepConfig {
  name: string;
  description: string;
  prompt?: string[];
  input?: string;
  output?: string;
  generate?: boolean;
  retry?: number;
  dialog?: boolean;
  subtask?: boolean;
  parallel?: boolean;
  HITL?: boolean;
  iterate?: string;
  while?: string;
  loop?: string;
  process?: boolean;
  concatenate?: string;
  evaluate?: string;
  benchmark?: string;
}

export interface TOMLWorkflowConfig {
  description: string;
  retry?: number;
  debug?: boolean;
  single_file?: boolean;
  stats?: boolean;
  step: TOMLStepConfig[];
}

export type NumberSetter = (index: number) => void;
export type NumberIncrementer = (increment: boolean) => number;

export enum State {
  // First prompt
  FIRST,

  // Send prompt and wait for response
  CONTINUE,

  // Next prompt
  NEXT,

  // Paused for user input
  PAUSED,

  // User hit escape twice
  CANCELLED,

  // Error requires HITL to correct and restart
  ERROR,

  // Workflow done
  DONE,
}

export enum Machine {
  STEP,
  GENERATE,
  ITERATE,
  WHILE,
  PROCESS,
}

export enum Status {
  PENDING,
  RETRY,
  SUBTASK_COMPLETE,
  STEP_DONE,
  HALT,
}
