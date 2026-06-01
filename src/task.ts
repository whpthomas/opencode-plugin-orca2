import * as fs from 'fs';
import { Status } from './types.js';

export class Task {
    constructor(
        // pre-resolved $OUTPUT for variable substitution, e.g. <job>/<step>/<output>
        readonly output: string,
        // $EACH for subtask variable substitution
        readonly each: string,
        // $INDEX for subtask tracking
        readonly index: number,
    ) {}
}

export class TaskState {
    status: Status;
    retry: number;

    constructor() {
        this.status = Status.PENDING;
        this.retry = 0;
    }

    update(retryMax: number, taskOutput: string): Status {
        if (fs.existsSync(taskOutput)) {
            this.retry = 0;
            this.status = Status.SUBTASK_COMPLETE;
        } else if(this.retry >= retryMax) {
            this.status = Status.HALT;
        } else {
            this.retry++;
            this.status = Status.RETRY;
        }
        return this.status;
    }

    reset(): void {
        this.status = Status.PENDING;
        this.retry = 0;
    }

}
