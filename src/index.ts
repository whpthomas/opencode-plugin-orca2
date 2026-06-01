import type { Plugin, Hooks, PluginInput } from '@opencode-ai/plugin';
import { clearLog, log } from './logger.js';
import { chatMessage } from './hooks/chat-message-hook.js';
import { chatMessagesTransform } from './hooks/chat-message-transform-hook.js';
import { event } from './hooks/event-hook.js';
import { setClient } from './state.js';

/**
 * Orca2 Plugin implementation with live agent integration
 */
export const orca2Plugin: Plugin = async (input: PluginInput) => {
  clearLog();
  log('=== Orca2 Plugin Initialized ===');

  // Store client for use in event hook
  setClient(input.client);

  const hooks: Hooks = {
    'chat.message': chatMessage,
    'experimental.chat.messages.transform': chatMessagesTransform,
    'event': event,
  };

  return hooks;
};

export default orca2Plugin;
