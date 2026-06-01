import * as fs from 'fs';
import { log } from '../logger.js';
import { getClient, getWorkflow, removeWorkflow } from '../state.js';
import { WorkflowState } from '../workflow.js';
import { Subtask } from '../subtask.js';
import { State } from '../types.js'

// Map of parent session ID to set of child session IDs
const subtaskMap = new Map<string, Set<string>>();
// Map of session ID to Subtask details
const subtaskLookup = new Map<string, Subtask>();

async function cleanupSubtask(client: any, sessionID: string): Promise<boolean> {
  const subtask = subtaskLookup.get(sessionID);
  if (subtask) {
    if(subtask.output && fs.existsSync(subtask.output)) {
      subtaskLookup.delete(sessionID);
      const set = subtaskMap.get(subtask.parentID);
      if (set) {
        set.delete(sessionID);
        if (set.size === 0) {
          subtaskMap.delete(subtask.parentID);
        }
      }
    } else if(subtask.retry < 3) {
        await client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{
                    type: "text",
                    text: "Please Continue"
                }]
            }
        });
        subtask.retry++;
        return false;
    }
  }
  // Also clean up any child subtasks if this session is a parent
  const children = subtaskMap.get(sessionID);
  if (children) {
    for (const childID of children) {
      subtaskLookup.delete(childID);
    }
    subtaskMap.delete(sessionID);
  }
  return true;
}

function subtaskLink(parentID: string, sessionID: string, subtask: Subtask) {
  subtask.parentID = parentID;
  subtaskLookup.set(sessionID, subtask);
  if (!subtaskMap.has(parentID)) subtaskMap.set(parentID, new Set());
  subtaskMap.get(parentID)!.add(sessionID);
}

async function subtaskComplete(sessionID: string) {
  const subtask = subtaskLookup.get(sessionID);
  if (!subtask) return;

  const tokens = subtask.tokens;
  subtaskLookup.delete(sessionID);
  const set = subtaskMap.get(subtask.parentID);
  if (set?.has(sessionID)) {
    set.delete(sessionID);
    const remaining = set.size;
    const state = getWorkflow(subtask.parentID);
    if (state) {
      const workflow = state.workflow;
        state.subtaskTokens += tokens;
        workflow.trace(`Subtask ${subtask.index} ${state.stepName} ${subtask.name} completed, ${tokens} tokens, ${remaining} remaining`);
        state.stats?.endSubtask(sessionID, tokens, subtask.retry);
    }
    if(remaining === 0) {
        subtaskMap.delete(subtask.parentID);
    }
  }
}

async function sequentialTask(client: any, sessionID: string, subtask: Subtask, state: WorkflowState) {
  const workflow = state.workflow;
  workflow.trace(`Sending '${state.stepName}' sequential prompt`);
  await client.tui.showToast({
      body: {
          title: `Step '${state.stepName}'`,
          message: state.stepDescription,
          variant: "info"
      }
  });
  await client.session.prompt({
      path: { id: sessionID },
      body: {
          parts: [{
              type: "text",
              text: subtask.prompt
          }]
      }
  });
}

async function waitForSubtask(client: any, sessionID: string, state: WorkflowState) {
  const pollInterval = 5050; // 5 seconds
  const workflow = state.workflow;
  let epoc = state.epoc;
  await new Promise(resolve => setTimeout(resolve, pollInterval));                 
  if(subtaskMap.has(sessionID)) {
      const count = subtaskMap.get(sessionID)?.size || 0;
      workflow.info(`Spawned ${count} subtask(s)`);
      const delay = 60000; // 1 minute
      let maxWait = count * delay; // subtask count x delay
      let startTime = Date.now();
      // Watchdog loop to wait for subtasks to complete, with a timeout based on the number of subtasks
      while (Date.now() - startTime < maxWait) {
          const subtasks = subtaskMap.get(sessionID);
          const count = subtasks?.size || 0;
          let parts:string[] = [];
          if(count === 0) {
              workflow.info('All subtasks completed');
              return;
          }
          if (epoc != state.epoc) {
              startTime = Date.now();
              maxWait = count * delay;
              epoc = state.epoc;
          }
          parts.push(`${epoc} turns, ${state.tokens + state.subtaskTokens} tokens\n`)
          if(subtasks) {
              let n = 0;
              for(const childID of subtasks) {
                  const subtask = subtaskLookup.get(childID);
                  if(subtask) {
                      parts.push(`Subtask ${subtask.index} ${state.stepName} ${subtask.name}, ${subtask.tokens.toLocaleString()} tokens`);
                      if(20 < n++) {
                          break;
                      } 
                  }
              }
          }
          const message = parts.join('\n');
          await client.tui.showToast({
              body: {
                  title: `Waiting on ${count} subtasks for ${state.stepName}`,
                  message: message,
                  variant: "info"
              }
          });
          await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      workflow.warn('Watchdog timer expired');
      // Clear subtasks
      const subtasks = subtaskMap.get(sessionID);
      if(subtasks) {
          for(const childID of subtasks) {
              subtaskLookup.delete(childID);
          }
      }
      subtaskMap.delete(sessionID);
  } else {
      workflow.error(`waitForSubtask() session ${sessionID} not found`);
  }
}

async function spawnSubtask(client: any, sessionID: string, subtask: Subtask, state: WorkflowState) {
  const workflow = state.workflow;
  workflow.trace(`Spawning ${state.stepName} ${subtask.name} for ${state.stepDescription}`);
  await client.tui.showToast({
      body: {
          title: `Spawn '${state.stepName}' subtask '${subtask.name}'`,
          message: `for ${state.stepDescription}`,
          variant: "info"
      }
  });

  const session = await client.session.create({
      body: {
          parentID: sessionID,
          title: `${state.stepName} - ${state.stepDescription}`,
      },
  });
  
  const childID = session.data.id;
  subtaskLink(sessionID, childID, subtask);

  state.stats?.beginSubtask(childID, subtask.name);

  // Use promptAsync to avoid blocking - returns immediately
  await client.session.promptAsync({
    path: { id: childID },
    body: { parts: [{ type: "text", text: subtask.prompt }]}
  });
}

async function spawnParallelSubtasks(client: any, sessionID: string, subtasks: Subtask[], state: WorkflowState) {
  await client.tui.showToast({
    body: {
      title: `Spawn ${subtasks.length} x ${state.stepName} subtasks`,
      message: state.stepDescription,
      variant: 'info'
    }
  });

  const createPromises = subtasks.map(async subtask => {
    const session = await client.session.create({
      body: {
        parentID: sessionID,
        title: `${state.stepName} subtask ${subtask.index}/${subtasks.length}`,
      }
    });

    const childID = session.data.id;
    subtaskLink(sessionID, childID, subtask);

    state.stats?.beginSubtask(childID, subtask.name);

    await client.session.promptAsync({
      path: { id: childID },
      body: { parts: [{ type: 'text', text: subtask.prompt }] }
    });
  });

  await Promise.all(createPromises);
}

export async function event(input: any) {
  const event = input.event;
  const properties = event.properties;
  if (!properties) return;

  const sessionID = properties.sessionID;
  if (!sessionID) return;

  const eventType: string = event.type;

  if (eventType === 'message.updated') {
    const tokens = properties.info?.tokens?.total;
    if (tokens) {
      const subtask = subtaskLookup.get(sessionID);
      if (subtask) subtask.tokens = tokens;
      const workflow = getWorkflow(sessionID);
      if (workflow) workflow.tokens = tokens;
    }
    return;
  }

  if (eventType === 'session.updated') {
    const subtask = subtaskLookup.get(sessionID);
    if(subtask) {
        const state = getWorkflow(subtask.parentID);
        if (state) {
            const workflow = state.workflow;
            if(subtask.epoc == 0) {
                workflow.trace(`Subtask ${subtask.index} ${state.stepName} ${subtask.name} created`);
            }
            subtask.epoc = state.nextEpoc();
        }
        subtask.turns++;
    }    
    return;
  }

  if (eventType !== 'session.idle') return;

  if (subtaskLookup.has(sessionID)) {
    await subtaskComplete(sessionID);
    return;
  }

  const client = getClient();
  if (!client) {
    log('ERROR', 'event() no client available');
    if(await cleanupSubtask(client, sessionID)) {
      removeWorkflow(sessionID);
    }
    return;
  }

  const state = getWorkflow(sessionID);
  if (!state) {
    await cleanupSubtask(client, sessionID);
    return;
  }
  const workflow = state.workflow;
  //workflow.trace('Session idle event');

  let currentState = state.state;
  const count = workflow.retry * workflow.steps.length * 2;
  let loop = true;
  for (let iteration = 0; loop && iteration < count; iteration++) {

    if (state.cancelled) {
        workflow.trace('Workflow cancelled, waiting for user input');
        return;
    }
    const resumed = state.resumed;
    currentState = await state.update();

    switch(currentState) {
      // @ts-ignore - intentional fallthrough
      case State.PENDING:
        workflow.trace('Sending dialog prompt');
      case State.FIRST:
      case State.NEXT:
        const subtasks = state.build(resumed);
        if(subtasks.length == 0) {
          workflow.info(`${State[currentState]} incomplete but no prompt`);
          return;
        }
        if (subtasks.length > 1) {
          workflow.trace(`${State[currentState]} ${subtasks.length} ${state.stepName} parallel subtasks`);
          await spawnParallelSubtasks(client, sessionID, subtasks, state);
          await waitForSubtask(client, sessionID, state);
        } else if (state.parallel) {
          workflow.trace(`${State[currentState]} ${subtasks.length} ${state.stepName} parallel subtask`);
          await spawnSubtask(client, sessionID, subtasks[0], state);
          await waitForSubtask(client, sessionID, state);
        } else {
          await sequentialTask(client, sessionID, subtasks[0], state);
          // Return form idle session
          return;
        }
        break;
      case State.PAUSED:
        workflow.trace('Workflow paused, waiting for user dialog');
        return;
      case State.CANCELLED:
        workflow.trace('Workflow cancelled, waiting for user input');
        return;
      case State.ERROR:
        workflow.trace(`Workflow halted, removing ${sessionID}`);
        await cleanupSubtask(client, sessionID);
        loop = false;
        break;
      case State.DONE:
        workflow.info(`Workflow complete - no more prompts, removing ${sessionID}`);
        await cleanupSubtask(client, sessionID);
        loop = false;
    }
  }
  state.stats?.finalize(State[currentState]);
  state.stats?.write(workflow.name, workflow.jobPath, state.startTime, state.tokens, state.subtaskTokens);
  removeWorkflow(sessionID);
}