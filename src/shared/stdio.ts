import type { JSONRPCMessage } from '@enth/mcp-specs/draft';
import { validateJSONRPCMessage } from '@enth/mcp-specs/draft';

/**
 * Buffers a continuous stdio stream into discrete JSON-RPC messages.
 */
export class ReadBuffer {
    private _buffer?: Buffer;

    append(chunk: Buffer): void {
        this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
    }

    readMessage(): JSONRPCMessage | null {
        if (!this._buffer) {
            return null;
        }

        const index = this._buffer.indexOf('\n');
        if (index === -1) {
            return null;
        }

        const line = this._buffer.toString('utf8', 0, index).replace(/\r$/, '');
        this._buffer = this._buffer.subarray(index + 1);
        return deserializeMessage(line);
    }

    clear(): void {
        this._buffer = undefined;
    }
}

export function deserializeMessage(line: string): JSONRPCMessage {
    const data = JSON.parse(line);
    const validationResult = validateJSONRPCMessage(data);
    if (!validationResult.valid) {
        const error = new Error(`Invalid JSON-RPC message: ${validationResult.errorMessage}`);
        throw error;
    }
    return data;
}

export function serializeMessage(message: JSONRPCMessage): string {
    return JSON.stringify(message) + '\n';
}
