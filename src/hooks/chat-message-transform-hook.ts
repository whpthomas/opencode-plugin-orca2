import { log } from '../logger.js';
import { getClient, getWorkflow } from '../state.js';
import { State } from '../types.js';

export async function chatMessagesTransform(_input: any, output: any) {
  const sessionID = output.messages[0]?.info?.sessionID;

  if (!sessionID) {
    log('ERROR', 'chatMessagesTransform() missing sessionID');
    return;
  }

  const state = getWorkflow(sessionID);
  if (!state) return;

  let currentState = state.state;
  if(currentState !== State.FIRST) return;

  const workflow = state.workflow;

  const prompt = workflow.firstPrompt();
  if (prompt === null) return;

  const systemMessages = output.messages.filter((m: any) => m.info?.role === 'system');
  const lastUserMessage = [...output.messages].reverse().find((m: any) => m.info?.role === 'user');

  if (!lastUserMessage) {
    log('ERROR', 'No user message found to replace');
    return;
  }

  lastUserMessage.parts = [{ type: 'text', text: prompt }];
  output.messages = [...systemMessages, lastUserMessage];

  workflow.trace("'Hello' prompt sent");

  const client = getClient();
  if (client) {
    await client.tui.showToast({
      body: {
        title: workflow.description,
        message: workflow.stepDescription(state.currentStep),
        variant: 'info'
      }
    });
  }
}