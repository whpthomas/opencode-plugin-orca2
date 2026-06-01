import { WorkflowState } from './workflow.js';

// Thread-safe Map to store workflows per session
const workflows = new Map<string, WorkflowState>();

// Store client for use in event hook
let client: any = null;

export function setWorkflow(sessionID: string, workflow: WorkflowState): void {
    workflows.set(sessionID,workflow);
}

export function getWorkflow(sessionID: string): WorkflowState | undefined {
    const workflow = workflows.get(sessionID);
    if (!workflow) {
        return undefined;
    }
     return workflow;
}

export function removeWorkflow(sessionID: string): void {
    workflows.delete(sessionID);
}

export function setClient(_client: any): void {
    client = _client;
}

export function getClient(): any {
    return client;
}
