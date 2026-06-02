import { NumberIncrementer } from "./types";

export class Subtask {
  parentID: string;
  name: string;
  index: number;
  prompt: string;
  output: string | null;

  epoc: number;
  turns: number;
  tokens: number;
  retryCounter: NumberIncrementer;

  constructor(name: string, index: number, prompt: string, output: string | null, retryCounter: NumberIncrementer) {
    this.parentID = '';
    this.name = name;
    this.index = index;
    this.prompt = prompt;
    this.output = output;

    this.epoc = 0;
    this.turns = 0;
    this.tokens = 0;
    this.retryCounter = retryCounter;
  }
}
