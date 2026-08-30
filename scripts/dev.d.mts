export function patchDevInfoPlist(source: string): string
export function prepareMacDevElectron(sourceDist: string, targetDist: string): Promise<string>
export function createDevEnvironment(
  targetDist: string,
  baseEnv?: NodeJS.ProcessEnv
): NodeJS.ProcessEnv
