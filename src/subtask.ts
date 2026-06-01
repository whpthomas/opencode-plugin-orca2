export class Subtask {
  parentID: string;
  name: string;
  index: number;
  prompt: string;

  epoc: number;
  turns: number;
  tokens: number;
  retry: number;

  constructor(name: string, index: number, prompt: string, retry: number) {
    this.parentID = '';
    this.name = name;
    this.index = index;
    this.prompt = prompt;

    this.epoc = 0;
    this.turns = 0;
    this.tokens = 0;
    this.retry = retry;
  }
}
