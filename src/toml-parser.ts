import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import type { TOMLWorkflowConfig, TOMLStepConfig } from './types.js';
import { log } from './logger.js';

export class ParseError {
  title: string;
  message: string;
  constructor(title: string, message: string) {
    this.title = title;
    this.message = message;
  }
}

const VALID_STEP_KEYS = new Set([
  'name', 'description', 'prompt', 'input', 'output',
  'retry', 'dialog', 'subtask', 'parallel',
  'iterate', 'while', 'loop', 'process', 'concatenate',
  'generate', 'HITL', 'evaluate'
]);

export function parseWorkflowTOML(workflowName: string, basePath?: string): { config: TOMLWorkflowConfig; filePath: string } | ParseError {
  const fileName = `${workflowName}.toml`;
  const workflowPath = basePath ? path.join(basePath, fileName) : path.join(process.cwd(), 'workflow', fileName);

  if (!fs.existsSync(workflowPath)) {
    return new ParseError('Workflow file not found', workflowPath);
  }

  let content: string;
  try {
    content = fs.readFileSync(workflowPath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new ParseError('Failed to read workflow file', message);
  }

  let raw: any;
  try {
    raw = toml.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new ParseError('Failed to parse TOML', message);
  }

  if (!raw.description || typeof raw.description !== 'string') {
    return new ParseError('Missing required field', 'description (must be a string)');
  }

  if (!raw.step || !Array.isArray(raw.step) || raw.step.length === 0) {
    return new ParseError('Missing required field', 'step (must be a non-empty array of tables [[step]])');
  }

  const config: TOMLWorkflowConfig = {
    description: raw.description,
    step: []
  };

  if (raw.retry !== undefined) {
    if (typeof raw.retry !== 'number') {
      return new ParseError('Invalid field', 'retry must be a number');
    }
    config.retry = raw.retry;
  }

  if (raw.debug !== undefined) {
    config.debug = Boolean(raw.debug);
  }

  if (raw.single_file !== undefined) {
    config.single_file = Boolean(raw.single_file);
  }

  if (raw.stats !== undefined) {
    config.stats = Boolean(raw.stats);
  }

  const names = new Set<string>();
  for (let i = 0; i < raw.step.length; i++) {
    const rawStep = raw.step[i];

    if (!rawStep.name || typeof rawStep.name !== 'string') {
      return new ParseError(`Step ${i + 1} missing required field`, 'name');
    }
    if (!rawStep.description || typeof rawStep.description !== 'string') {
      return new ParseError(`Step ${i + 1} ('${rawStep.name}') missing required field`, 'description');
    }

    if (names.has(rawStep.name)) {
      return new ParseError('Duplicate step name', rawStep.name);
    }
    names.add(rawStep.name);

    for (const key of Object.keys(rawStep)) {
      if (!VALID_STEP_KEYS.has(key)) {
        log('WARN', `Unknown key '${key}' in step '${rawStep.name}'`);
      }
    }

    const step: TOMLStepConfig = {
      name: rawStep.name,
      description: rawStep.description,
    };

    if (rawStep.prompt !== undefined) {
      if (typeof rawStep.prompt === 'string') {
        step.prompt = [rawStep.prompt];
      } else if (!Array.isArray(rawStep.prompt) || !rawStep.prompt.every((e: any) => typeof e === 'string')) {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'prompt must be a string or array of strings');
      } else {
        step.prompt = rawStep.prompt;
      }
    }

    if (rawStep.input !== undefined) {
      if (typeof rawStep.input !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'input must be a string');
      }
      step.input = rawStep.input;
    }

    if (rawStep.output !== undefined) {
      if (typeof rawStep.output !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'output must be a string');
      }
      step.output = rawStep.output;
    }

    if (rawStep.generate !== undefined) step.generate = Boolean(rawStep.generate);

    if (rawStep.retry !== undefined) {
      if (typeof rawStep.retry !== 'number') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'retry must be a number');
      }
      step.retry = rawStep.retry;
    }

    if (rawStep.dialog !== undefined) step.dialog = Boolean(rawStep.dialog);
    if (rawStep.subtask !== undefined) step.subtask = Boolean(rawStep.subtask);
    if (rawStep.parallel !== undefined) step.parallel = Boolean(rawStep.parallel);
    if (rawStep.HITL !== undefined) step.HITL = Boolean(rawStep.HITL);

    if (rawStep.iterate !== undefined) {
      if (typeof rawStep.iterate !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'iterate must be a string (directory path)');
      }
      step.iterate = rawStep.iterate;
    }

    if (rawStep.while !== undefined) {
      if (typeof rawStep.while !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'while must be a string (step name)');
      }
      step.while = rawStep.while;
    }

    if (rawStep.loop !== undefined) {
      if (typeof rawStep.loop !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'loop must be a string (step name)');
      }
      step.loop = rawStep.loop;
    }

    if (rawStep.process !== undefined) step.process = Boolean(rawStep.process);

    if (rawStep.concatenate !== undefined) {
      if (typeof rawStep.concatenate !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'concatenate must be a string');
      }
      step.concatenate = rawStep.concatenate;
    }

    if (rawStep.evaluate !== undefined) {
      if (typeof rawStep.evaluate !== 'string') {
        return new ParseError(`Step '${rawStep.name}' invalid field`, 'evaluate must be a string');
      }
      step.evaluate = rawStep.evaluate;
    }

    config.step.push(step);
  }

  log('INFO', `Loaded ${config.step.length} step from ${workflowPath}`);
  return { config, filePath: workflowPath };
}
