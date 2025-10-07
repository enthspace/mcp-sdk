import type { ProtocolOptions, RequestOptions } from '../shared/protocol.js';
import { mergeCapabilities, Protocol } from '../shared/protocol.js';
import { SUPPORTED_PROTOCOL_VERSIONS } from '../constants.js';
import { McpError, ErrorCode } from '../errors.js';
import type {
    ClientCapabilities,
    CreateMessageRequest,
    ElicitRequest,
    ElicitResult,
    Implementation,
    InitializeRequest,
    InitializeResult,
    ListRootsRequest,
    LoggingMessageNotification,
    Notification,
    Request,
    ResourceUpdatedNotification,
    Result,
    ServerCapabilities,
    ServerNotification,
    ServerRequest,
    ServerResult,
    LoggingLevel,
    SetLevelRequest,
    InitializedNotification
} from '@enth/mcp-specs/draft';
import {
    LATEST_PROTOCOL_VERSION,
    LoggingLevelSchema,
    validateInitializeRequest,
    validateSetLevelRequest,
    validateInitializedNotification,
    validateCreateMessageResult,
    validateElicitResult,
    validateListRootsResult,
    validateEmptyResult,
    isLoggingLevel
} from '@enth/mcp-specs/draft';
import type { JsonSchemaType } from '@enth/mcp-specs';

export type ServerOptions = ProtocolOptions & {
    /**
     * Capabilities to advertise as being supported by this server.
     */
    capabilities?: ServerCapabilities;

    /**
     * Optional instructions describing how to use the server and its features.
     */
    instructions?: string;
};

/**
 * An MCP server on top of a pluggable transport.
 *
 * This server will automatically respond to the initialization flow as initiated from the client.
 *
 * To use with custom types, extend the base Request/Notification/Result types and pass them as type parameters:
 *
 * ```typescript
 * // Custom schemas
 * const CustomRequestSchema = RequestSchema.extend({...})
 * const CustomNotificationSchema = NotificationSchema.extend({...})
 * const CustomResultSchema = ResultSchema.extend({...})
 *
 * // Type aliases
 * type CustomRequest = z.infer<typeof CustomRequestSchema>
 * type CustomNotification = z.infer<typeof CustomNotificationSchema>
 * type CustomResult = z.infer<typeof CustomResultSchema>
 *
 * // Create typed server
 * const server = new Server<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomServer",
 *   version: "1.0.0"
 * })
 * ```
 */
export class Server<
    RequestT extends Request = Request,
    NotificationT extends Notification = Notification,
    ResultT extends Result = Result
> extends Protocol<
    Omit<ServerRequest, 'jsonrpc' | 'id'> | RequestT,
    Omit<ServerNotification, 'jsonrpc'> | NotificationT,
    ServerResult | ResultT
> {
    private _clientCapabilities?: ClientCapabilities;
    private _clientVersion?: Implementation;
    private _capabilities: ServerCapabilities;
    private _instructions?: string;

    /**
     * Callback for when initialization has fully completed (i.e., the client has sent an `initialized` notification).
     */
    oninitialized?: () => void;

    /**
     * Initializes this server with the given name and version information.
     */
    constructor(
        private _serverInfo: Implementation,
        options?: ServerOptions
    ) {
        super(options);
        this._capabilities = options?.capabilities ?? {};
        this._instructions = options?.instructions;

        this.setRequestHandler('initialize' satisfies InitializeRequest['method'], validateInitializeRequest, request =>
            this._oninitialize(request)
        );
        this.setNotificationHandler(
            'notifications/initialized' satisfies InitializedNotification['method'],
            validateInitializedNotification,
            () => this.oninitialized?.()
        );

        if (this._capabilities.logging) {
            this.setRequestHandler(
                'logging/setLevel' satisfies SetLevelRequest['method'],
                validateSetLevelRequest,
                async (request, extra) => {
                    const transportSessionId: string | undefined =
                        extra.sessionId || (extra.requestInfo?.headers['mcp-session-id'] as string) || undefined;
                    const { level } = request.params;
                    if (isLoggingLevel(level)) {
                        this._loggingLevels.set(transportSessionId, level);
                    }
                    return {};
                }
            );
        }
    }

    // Map log levels by session id
    private _loggingLevels = new Map<string | undefined, LoggingLevel>();

    // Map LogLevelSchema to severity index
    private readonly LOG_LEVEL_SEVERITY = new Map(LoggingLevelSchema.enum.map((level, index) => [level, index]));

    // Is a message with the given level ignored in the log level set for the given session id?
    private isMessageIgnored = (level: LoggingLevel, sessionId?: string): boolean => {
        const currentLevel = this._loggingLevels.get(sessionId);
        return currentLevel ? this.LOG_LEVEL_SEVERITY.get(level)! < this.LOG_LEVEL_SEVERITY.get(currentLevel)! : false;
    };

    /**
     * Registers new capabilities. This can only be called before connecting to a transport.
     *
     * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
     */
    public registerCapabilities(capabilities: ServerCapabilities): void {
        if (this.transport) {
            throw new Error('Cannot register capabilities after connecting to transport');
        }
        this._capabilities = mergeCapabilities(this._capabilities, capabilities);
    }

    protected assertCapabilityForMethod(method: RequestT['method']): void {
        switch (method as ServerRequest['method']) {
            case 'sampling/createMessage':
                if (!this._clientCapabilities?.sampling) {
                    throw new Error(`Client does not support sampling (required for ${method})`);
                }
                break;

            case 'elicitation/create':
                if (!this._clientCapabilities?.elicitation) {
                    throw new Error(`Client does not support elicitation (required for ${method})`);
                }
                break;

            case 'roots/list':
                if (!this._clientCapabilities?.roots) {
                    throw new Error(`Client does not support listing roots (required for ${method})`);
                }
                break;

            case 'ping':
                // No specific capability required for ping
                break;
        }
    }

    protected assertNotificationCapability(method: (Omit<ServerNotification, 'jsonrpc'> | NotificationT)['method']): void {
        switch (method as ServerNotification['method']) {
            case 'notifications/message':
                if (!this._capabilities.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;

            case 'notifications/resources/updated':
            case 'notifications/resources/list_changed':
                if (!this._capabilities.resources) {
                    throw new Error(`Server does not support notifying about resources (required for ${method})`);
                }
                break;

            case 'notifications/tools/list_changed':
                if (!this._capabilities.tools) {
                    throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
                }
                break;

            case 'notifications/prompts/list_changed':
                if (!this._capabilities.prompts) {
                    throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
                }
                break;

            case 'notifications/cancelled':
                // Cancellation notifications are always allowed
                break;

            case 'notifications/progress':
                // Progress notifications are always allowed
                break;
        }
    }

    protected assertRequestHandlerCapability(method: string): void {
        switch (method) {
            case 'sampling/createMessage':
                // @ts-expect-error The server isn't supposed to know about client capabilities
                if (!this._capabilities.sampling) {
                    throw new Error(`Server does not support sampling (required for ${method})`);
                }
                break;

            case 'logging/setLevel':
                if (!this._capabilities.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;

            case 'prompts/get':
            case 'prompts/list':
                if (!this._capabilities.prompts) {
                    throw new Error(`Server does not support prompts (required for ${method})`);
                }
                break;

            case 'resources/list':
            case 'resources/templates/list':
            case 'resources/read':
                if (!this._capabilities.resources) {
                    throw new Error(`Server does not support resources (required for ${method})`);
                }
                break;

            case 'tools/call':
            case 'tools/list':
                if (!this._capabilities.tools) {
                    throw new Error(`Server does not support tools (required for ${method})`);
                }
                break;

            case 'ping':
            case 'initialize':
                // No specific capability required for these methods
                break;
        }
    }

    private async _oninitialize(request: InitializeRequest): Promise<InitializeResult> {
        const requestedVersion = request.params.protocolVersion;

        this._clientCapabilities = request.params.capabilities;
        this._clientVersion = request.params.clientInfo;

        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;

        return {
            protocolVersion,
            capabilities: this.getCapabilities(),
            serverInfo: this._serverInfo,
            ...(this._instructions && { instructions: this._instructions })
        };
    }

    /**
     * After initialization has completed, this will be populated with the client's reported capabilities.
     */
    getClientCapabilities(): ClientCapabilities | undefined {
        return this._clientCapabilities;
    }

    /**
     * After initialization has completed, this will be populated with information about the client's name and version.
     */
    getClientVersion(): Implementation | undefined {
        return this._clientVersion;
    }

    private getCapabilities(): ServerCapabilities {
        return this._capabilities;
    }

    async ping() {
        return this.request({ method: 'ping' }, validateEmptyResult);
    }

    async createMessage(params: CreateMessageRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'sampling/createMessage', params }, validateCreateMessageResult, options);
    }

    async elicitInput(params: ElicitRequest['params'], options?: RequestOptions): Promise<ElicitResult> {
        const result = await this.request({ method: 'elicitation/create', params }, validateElicitResult, options);

        // Validate the response content against the requested schema if action is "accept"
        if (result.action === 'accept' && result.content) {
            try {
                const validator = await this.createValidator(params.requestedSchema as JsonSchemaType<object>);
                const validatedContent = validator(result.content);

                if (!validatedContent.valid) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        `Elicitation response content does not match requested schema: ${validatedContent.errorMessage}`
                    );
                }
            } catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error}`);
            }
        }

        return result;
    }

    async listRoots(params?: ListRootsRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'roots/list', params }, validateListRootsResult, options);
    }

    /**
     * Sends a logging message to the client, if connected.
     * Note: You only need to send the parameters object, not the entire JSON RPC message
     * @see LoggingMessageNotification
     * @param params
     * @param sessionId optional for stateless and backward compatibility
     */
    async sendLoggingMessage(params: LoggingMessageNotification['params'], sessionId?: string) {
        if (this._capabilities.logging) {
            if (!this.isMessageIgnored(params.level, sessionId)) {
                return this.notification({ method: 'notifications/message', params });
            }
        }
    }

    async sendResourceUpdated(params: ResourceUpdatedNotification['params']) {
        return this.notification({
            method: 'notifications/resources/updated',
            params
        });
    }

    async sendResourceListChanged() {
        return this.notification({
            method: 'notifications/resources/list_changed'
        });
    }

    async sendToolListChanged() {
        return this.notification({ method: 'notifications/tools/list_changed' });
    }

    async sendPromptListChanged() {
        return this.notification({ method: 'notifications/prompts/list_changed' });
    }
}
