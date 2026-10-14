import { describe, expect, it } from 'vitest';
import { HEARTBEAT, heartbeatSchema, PROTOCOL_VERSION } from './messages';

describe('heartbeatSchema', () => {
  it('accepts the heartbeat the app sends', () => {
    expect(heartbeatSchema.safeParse(HEARTBEAT).success).toBe(true);
  });

  it('refuses a heartbeat from another protocol version', () => {
    const other = { v: PROTOCOL_VERSION + 1, type: 'heartbeat' };
    expect(heartbeatSchema.safeParse(other).success).toBe(false);
  });

  it('refuses another message type', () => {
    expect(heartbeatSchema.safeParse({ v: PROTOCOL_VERSION, type: 'ping' }).success).toBe(false);
  });
});
