// shortcut: the few Node APIs the harness scripts and vite.config.ts use, declared here because the repo has no @types/node; add that package if the harness grows.
declare module 'node:fs' {
  export function mkdirSync(path: string, options: { recursive: true }): void;
  export function writeFileSync(path: string, data: string): void;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readFileSync(path: string): Uint8Array;
  export function readdirSync(path: string): string[];
  export function readdirSync(path: string, options: { recursive: true; withFileTypes: true }): { name: string; parentPath: string; isFile(): boolean }[];
  export function existsSync(path: string): boolean;
}
declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
}
declare module 'node:util' {
  export function parseArgs<T>(config: { options: Record<string, { type: 'string' | 'boolean'; default?: string | boolean }> }): { values: T };
}
declare const process: { exit(code: number): never };
