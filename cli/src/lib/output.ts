export type CurrentLocation = {
  mission_id: string;
  stage: string;
  task_id: string;
  phase: string;
};

export type GuardFailure = {
  code: string;
  path?: string;
  status?: 'missing' | 'mismatched' | 'invalid';
  detail?: string;
};

export type WriteRecord = {
  path: string;
  type: 'created' | 'updated';
};

export type StateChange = {
  pointer: string;
  from: string;
  to: string;
};

export type SuccessResult = {
  ok: true;
  command: string;
  current: CurrentLocation;
  writes: WriteRecord[];
  state_changes: StateChange[];
};

export type FailureResult = {
  ok: false;
  command: string;
  current: CurrentLocation;
  writes: [];
  error: {
    code: string;
    guards?: GuardFailure[];
    detail?: string;
  };
};

export function emptyLocation(): CurrentLocation {
  return { mission_id: '', stage: '', task_id: '', phase: '' };
}

export function success(result: SuccessResult): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

export function failure(result: FailureResult): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(1);
}
