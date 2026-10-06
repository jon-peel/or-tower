// Where downloaded data (VATSpy, airline tails) is cached on disk.
// Locally: data/ in the project. Serverless (Netlify Functions run on AWS Lambda): only the temp
// dir is writable, and it lasts as long as the function instance stays warm.

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SERVERLESS = !!process.env.LAMBDA_TASK_ROOT;

export const DATA_DIR: URL = process.env.OR_TOWER_DATA_DIR
  ? pathToFileURL(`${process.env.OR_TOWER_DATA_DIR}/`)
  : SERVERLESS
    ? pathToFileURL(`${join(tmpdir(), 'or-tower')}/`)
    : new URL('../../data/', import.meta.url);
