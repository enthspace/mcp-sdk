import type { ProtocolOptions, RequestOptions } from '../shared/protocol.js';
import { mergeCapabilities, Protocol } from '../shared/protocol.js';
import type { Transport } from '../shared/transport.js';
import { SUPPORTED_PROTOCOL_VERSIONS } from '../constants.js';
import type { JsonSchemaType, JsonSchemaValidator } from '@enth/mcp-specs';
import type {
    CallToolRequest,
    CallToolResult,
    ClientCapabilities,
    ClientNotification,
    ClientRequest,
    ClientResult,
    CompleteRequest,
    GetPromptRequest,
    Implementation,
    ListPromptsRequest,
    ListResourcesRequest,
    ListResourceTemplatesRequest,
    ListToolsRequest,
    LoggingLevel,
    Notification,
    ReadResourceRequest,
    Request,
    Result,
    ServerCapabilities,
    SubscribeRequest,
    UnsubscribeRequest,
    Tool
} from '@enth/mcp-specs/draft';
import { ErrorCode, McpError } from '../errors.js';
import {
    LATEST_PROTOCOL_VERSION,
    validateCompleteResult,
    validateEmptyResult,
    validateGetPromptResult,
    validateInitializeResult,
    validateListPromptsResult,
    validateListResourcesResult,
    validateListResourceTemplatesResult,
    validateReadResourceResult,
    validateCallToolResult,
    validateListToolsResult
} from '@enth/mcp-specs/draft';

export type ClientOptions = ProtocolOptions & {
    /**
     * Capabilities to advertise as being supported by this client.
     */
    capabilities?: ClientCapabilities;
};

/**
 * An MCP client on top of a pluggable transport.
 *
 * The client will automatically begin the initialization flow with the server when connect() is called.
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
 * // Create typed client
 * const client = new Client<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomClient",
 *   version: "1.0.0"
 * })
 * ```
 */
export class Client<
    RequestT extends Request = Request,
    NotificationT extends Notification = Notification,
    ResultT extends Result = Result
> extends Protocol<
    Omit<ClientRequest, 'jsonrpc' | 'id'> | RequestT,
    Omit<ClientNotification, 'jsonrpc'> | NotificationT,
    ClientResult | ResultT
> {
    private _serverCapabilities?: ServerCapabilities;
    private _serverVersion?: Implementation;
    private _capabilities: ClientCapabilities;
    private _instructions?: string;
    private _cachedToolOutputValidators: Map<string, JsonSchemaValidator<unknown>> = new Map();
    private _clientInfo: Implementation;

    /**
     * Initializes this client with the given name and version information.
     */
    constructor(clientInfo: Implementation, options?: ClientOptions) {
        super(options);
        this._clientInfo = clientInfo;
        this._capabilities = options?.capabilities ?? {};
    }

    /**
     * Registers new capabilities. This can only be called before connecting to a transport.
     *
     * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
     */
    public registerCapabilities(capabilities: ClientCapabilities): void {
        if (this.transport) {
            throw new Error('Cannot register capabilities after connecting to transport');
        }

        this._capabilities = mergeCapabilities(this._capabilities, capabilities);
    }

    protected assertCapability(capability: keyof ServerCapabilities, method: string): void {
        if (!this._serverCapabilities?.[capability]) {
            throw new Error(`Server does not support ${capability} (required for ${method})`);
        }
    }

    override async connect(transport: Transport, options?: RequestOptions): Promise<void> {
        await super.connect(transport);
        // When transport sessionId is already set this means we are trying to reconnect.
        // In this case we don't need to initialize again.
        if (transport.sessionId !== undefined) {
            return;
        }
        try {
            const result = await this.request(
                {
                    method: 'initialize',
                    params: {
                        protocolVersion: LATEST_PROTOCOL_VERSION,
                        capabilities: this._capabilities,
                        clientInfo: this._clientInfo
                    }
                },
                validateInitializeResult,
                options
            );

            if (result === undefined) {
                throw new Error(`Server sent invalid initialize result: ${result}`);
            }

            if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
                throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
            }

            this._serverCapabilities = result.capabilities;
            this._serverVersion = result.serverInfo;
            // HTTP transports must set the protocol version in each header after initialization.
            if (transport.setProtocolVersion) {
                transport.setProtocolVersion(result.protocolVersion);
            }

            this._instructions = result.instructions;

            await this.notification({
                method: 'notifications/initialized'
            });
        } catch (error) {
            // Disconnect if initialization fails.
            void this.close();
            throw error;
        }
    }

    /**
     * After initialization has completed, this will be populated with the server's reported capabilities.
     */
    getServerCapabilities(): ServerCapabilities | undefined {
        return this._serverCapabilities;
    }

    /**
     * After initialization has completed, this will be populated with information about the server's name and version.
     */
    getServerVersion(): Implementation | undefined {
        return this._serverVersion;
    }

    /**
     * After initialization has completed, this may be populated with information about the server's instructions.
     */
    getInstructions(): string | undefined {
        return this._instructions;
    }

    protected assertCapabilityForMethod(method: RequestT['method']): void {
        switch (method as ClientRequest['method']) {
            case 'logging/setLevel':
                if (!this._serverCapabilities?.logging) {
                    throw new Error(`Server does not support logging (required for ${method})`);
                }
                break;

            case 'prompts/get':
            case 'prompts/list':
                if (!this._serverCapabilities?.prompts) {
                    throw new Error(`Server does not support prompts (required for ${method})`);
                }
                break;

            case 'resources/list':
            case 'resources/templates/list':
            case 'resources/read':
            case 'resources/subscribe':
            case 'resources/unsubscribe':
                if (!this._serverCapabilities?.resources) {
                    throw new Error(`Server does not support resources (required for ${method})`);
                }

                if (method === 'resources/subscribe' && !this._serverCapabilities.resources.subscribe) {
                    throw new Error(`Server does not support resource subscriptions (required for ${method})`);
                }

                break;

            case 'tools/call':
            case 'tools/list':
                if (!this._serverCapabilities?.tools) {
                    throw new Error(`Server does not support tools (required for ${method})`);
                }
                break;

            case 'completion/complete':
                if (!this._serverCapabilities?.completions) {
                    throw new Error(`Server does not support completions (required for ${method})`);
                }
                break;

            case 'initialize':
                // No specific capability required for initialize
                break;

            case 'ping':
                // No specific capability required for ping
                break;
        }
    }

    protected assertNotificationCapability(method: NotificationT['method']): void {
        switch (method as ClientNotification['method']) {
            case 'notifications/roots/list_changed':
                if (!this._capabilities.roots?.listChanged) {
                    throw new Error(`Client does not support roots list changed notifications (required for ${method})`);
                }
                break;

            case 'notifications/initialized':
                // No specific capability required for initialized
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
                if (!this._capabilities.sampling) {
                    throw new Error(`Client does not support sampling capability (required for ${method})`);
                }
                break;

            case 'elicitation/create':
                if (!this._capabilities.elicitation) {
                    throw new Error(`Client does not support elicitation capability (required for ${method})`);
                }
                break;

            case 'roots/list':
                if (!this._capabilities.roots) {
                    throw new Error(`Client does not support roots capability (required for ${method})`);
                }
                break;

            case 'ping':
                // No specific capability required for ping
                break;
        }
    }

    async ping(options?: RequestOptions) {
        return this.request({ method: 'ping' }, validateEmptyResult, options);
    }

    async complete(params: CompleteRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'completion/complete', params }, validateCompleteResult, options);
    }

    async setLoggingLevel(level: LoggingLevel, options?: RequestOptions) {
        return this.request({ method: 'logging/setLevel', params: { level } }, validateEmptyResult, options);
    }

    async getPrompt(params: GetPromptRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'prompts/get', params }, validateGetPromptResult, options);
    }

    async listPrompts(params?: ListPromptsRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'prompts/list', params }, validateListPromptsResult, options);
    }

    async listResources(params?: ListResourcesRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'resources/list', params }, validateListResourcesResult, options);
    }

    async listResourceTemplates(params?: ListResourceTemplatesRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'resources/templates/list', params }, validateListResourceTemplatesResult, options);
    }

    async readResource(params: ReadResourceRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'resources/read', params }, validateReadResourceResult, options);
    }

    async subscribeResource(params: SubscribeRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'resources/subscribe', params }, validateEmptyResult, options);
    }

    async unsubscribeResource(params: UnsubscribeRequest['params'], options?: RequestOptions) {
        return this.request({ method: 'resources/unsubscribe', params }, validateEmptyResult, options);
    }

    async callTool(
        params: CallToolRequest['params'],
        resultSchemaOrValidator: JsonSchemaValidator<CallToolResult> = validateCallToolResult,
        options?: RequestOptions
    ) {
        const result = await this.request<CallToolResult>({ method: 'tools/call', params }, resultSchemaOrValidator, options);

        // Check if the tool has an outputSchema
        const validator = this.getToolOutputValidator(params.name);
        if (validator) {
            // If tool has outputSchema, it MUST return structuredContent (unless it's an error)
            if (!result.structuredContent && !result.isError) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Tool ${params.name} has an output schema but did not return structured content`
                );
            }

            // Only validate structured content if present (not when there's an error)
            if (result.structuredContent) {
                try {
                    // Validate the structured content (which is already an object) against the schema
                    const validatedContent = validator(result.structuredContent);

                    if (!validatedContent.valid) {
                        throw new McpError(
                            ErrorCode.InvalidParams,
                            `Structured content does not match the tool's output schema: ${validatedContent.errorMessage} for tool ${params.name} with structured content ${JSON.stringify(result.structuredContent)}`
                        );
                    }
                } catch (error) {
                    if (error instanceof McpError) {
                        throw error;
                    }
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        `Failed to validate structured content: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        }

        return result;
    }

    private async cacheToolOutputSchemas(tools: Tool[]) {
        this._cachedToolOutputValidators.clear();

        for (const tool of tools) {
            // If the tool has an outputSchema, create and cache the validator
            if (tool.outputSchema) {
                try {
                    const validator = await this.createValidator(tool.outputSchema as JsonSchemaType<object>);
                    this._cachedToolOutputValidators.set(tool.name, validator);
                } catch {
                    // Ignore schema compilation errors
                }
            }
        }
    }

    private getToolOutputValidator(toolName: string): JsonSchemaValidator<unknown> | undefined {
        return this._cachedToolOutputValidators.get(toolName);
    }

    async listTools(params?: ListToolsRequest['params'], options?: RequestOptions) {
        const result = await this.request({ method: 'tools/list', params }, validateListToolsResult, options);

        // Cache the tools and their output schemas for future validation
        await this.cacheToolOutputSchemas(result.tools);

        return result;
    }

    async sendRootsListChanged() {
        return this.notification({ method: 'notifications/roots/list_changed' });
    }
}
