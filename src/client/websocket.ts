import type { Transport } from '../shared/transport.js';
import type { JSONRPCMessage } from '@enth/mcp-specs/draft';
import { validateJSONRPCMessage } from '@enth/mcp-specs/draft';

const SUBPROTOCOL = 'mcp';

/**
 * Client transport for WebSocket: this will connect to a server over the WebSocket protocol.
 */
export class WebSocketClientTransport implements Transport {
    private _socket?: WebSocket;
    private _url: URL;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    constructor(url: URL) {
        this._url = url;
    }

    start(): Promise<void> {
        if (this._socket) {
            throw new Error(
                'WebSocketClientTransport already started! If using Client class, note that connect() calls start() automatically.'
            );
        }

        return new Promise((resolve, reject) => {
            this._socket = new WebSocket(this._url, SUBPROTOCOL);

            this._socket.onerror = event => {
                const error = 'error' in event ? (event.error as Error) : new Error(`WebSocket error: ${JSON.stringify(event)}`);
                reject(error);
                this.onerror?.(error);
            };

            this._socket.onopen = () => {
                resolve();
            };

            this._socket.onclose = () => {
                this.onclose?.();
            };

            this._socket.onmessage = (event: MessageEvent) => {
                const message: unknown = JSON.parse(event.data);
                const validatedMessage = validateJSONRPCMessage(message);
                if (!validatedMessage.valid) {
                    const error = new Error(`Invalid JSON-RPC message: ${validatedMessage.errorMessage}`);
                    this.onerror?.(error);
                    return;
                }

                this.onmessage?.(validatedMessage.data);
            };
        });
    }

    async close(): Promise<void> {
        this._socket?.close();
    }

    send(message: JSONRPCMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._socket) {
                reject(new Error('Not connected'));
                return;
            }

            this._socket?.send(JSON.stringify(message));
            resolve();
        });
    }
}
