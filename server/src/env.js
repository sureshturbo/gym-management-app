// Load server/.env when it exists (local dev, or a .env placed on the host).
// Hosts that set environment variables in their control panel need no file;
// variables that are already set are never overridden.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
