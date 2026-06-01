import { log } from '../logger.js';
import { WorkflowState } from '../workflow.js';
import { getClient, getWorkflow, setWorkflow } from '../state.js';

export function matchWorkflow(input: string): string[] | null {
  const pattern = /^"?#{\s*(.+?)\s*}"?$/i;
  const match = input.match(pattern);
  if (!match) return null;

  const innerContent = match[1];

  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < innerContent.length; i++) {
    const char = innerContent[i];

    if ((char === '"' || char === "'") && (i === 0 || innerContent[i - 1] !== '\\')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
        quoteChar = '';
      } else {
        current += char;
      }
    } else if (char === ' ' && !inQuote) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) args.push(current);
  return args.length > 0 ? args : null;
}

export async function chatMessage(input: any, _output: any) {
  const sessionID = input.sessionID;

  const messageText = _output.parts
    .filter((p: any) => p.type === 'text' && 'text' in p)
    .map((p: any) => p.text)
    .join(' ');

  if (!messageText) return;

  const match = matchWorkflow(messageText);
  if (!match) return;

  const workflowName = match[0];
  const job = match[1];
  const process = match[2];

  if (!job) {
    log('ERROR', 'Workflow invocation missing job argument. Expected: #{workflow job [process]}');
    return;
  }

  log('INFO', `#{${workflowName} ${job}${process ? ' ' + process : ''}} invocation detected`);

  const currentState = getWorkflow(sessionID);
  if(currentState) {
    log('INFO', `Existing session ${sessionID} found, #{${currentState.workflow.name}... } restarted`);
    return;
  }

  const state = new WorkflowState(sessionID, workflowName, job, process);
  const err = state.load();

  if (err == null) {
    setWorkflow(sessionID, state);
    log('INFO', `#{${workflowName}... } session ${sessionID} started`);
  } else {
    state.workflow.logErr(err);
    const client = getClient();
    if (client) {
      await client.tui.showToast({
        body: {
          title: err.title,
          message: err.message,
          variant: 'error'
        }
      });
    }
  }
}