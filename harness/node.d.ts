// shortcut: the few Node APIs harness/run.ts uses, typed by hand because the repo has no @types/node; add that package if the harness grows.
declare module 'node:fs' {
  export function mkdirSync(path: string, options: { recursive: true }): void;
  export function writeFileSync(path: string, data: string): void;
}
declare module 'node:path' {
  export function dirname(path: string): string;
}
declare module 'node:util' {
  export function parseArgs<T>(config: { options: Record<string, { type: 'string' | 'boolean'; default?: string | boolean }> }): { values: T };
}
declare const process: { exit(code: number): never };
