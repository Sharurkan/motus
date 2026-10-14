import * as z from 'zod/mini';

/** Phones and TVs must run the same version: any other version is refused. */
export const PROTOCOL_VERSION = 1;

const version = z.literal(PROTOCOL_VERSION);

export const heartbeatSchema = z.object({ v: version, type: z.literal('heartbeat') });

export type HeartbeatMessage = z.infer<typeof heartbeatSchema>;

export const HEARTBEAT: HeartbeatMessage = { v: PROTOCOL_VERSION, type: 'heartbeat' };
