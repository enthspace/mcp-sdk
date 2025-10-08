import Type from 'typebox';
import Value from 'typebox/value';
import Format from 'typebox/format';
import type { AuthInfo } from '../server/auth/types.js';

export const LATEST_PROTOCOL_VERSION = '2025-06-18';
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26';
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-03-26', '2024-11-05', '2024-10-07'];

// ------------------------------------------------------------------
// Formats
// ------------------------------------------------------------------
Format.Set('base64', value => {
    try {
        // atob throws a DOMException if the string contains characters
        // that are not part of the Base64 character set.
        atob(value);
        return true;
    } catch {
        return false;
    }
});

// Optional: Limits to file:// only (as per Zod implementation). Both TypeBox and Ajv have
// spec compliant implementations for Uri https://sinclairzx81.github.io/typebox/#/docs/format/uri
// Format.Set('uri', value => value.startsWith('file://')) // Uncomment for Zod behaviour

// ------------------------------------------------------------------
// Prototol Types
// ------------------------------------------------------------------

/* JSON-RPC types */
export const JSONRPC_VERSION = '2.0';

/**
 * A progress token, used to associate progress notifications with the original request.
 */
export const ProgressTokenSchema = Type.Union([Type.String(), Type.Integer()]);

/**
 * An opaque token used to represent a cursor for pagination.
 */
export const CursorSchema = Type.String();

const RequestMetaSchema = Type.Object({
    /**
     * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
     */
    progressToken: Type.Optional(ProgressTokenSchema)
});

const BaseRequestParamsSchema = Type.Object({
    _meta: Type.Optional(RequestMetaSchema)
});

export const RequestSchema = Type.Object({
    method: Type.String(),
    params: Type.Optional(BaseRequestParamsSchema)
});

const BaseNotificationParamsSchema = Type.Object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

export const NotificationSchema = Type.Object({
    method: Type.String(),
    params: Type.Optional(BaseNotificationParamsSchema)
});

export const ResultSchema = Type.Object({
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
export const RequestIdSchema = Type.Union([Type.String(), Type.Integer()]);

/**
 * A request that expects a response.
 */
export const JSONRPCRequestSchema = Type.Interface(
    [RequestSchema],
    {
        jsonrpc: Type.Literal(JSONRPC_VERSION),
        id: RequestIdSchema
    },
    {
        additionalProperties: false
    }
);

export const isJSONRPCRequest = (value: unknown): value is JSONRPCRequest => Value.Check(JSONRPCRequestSchema, value);

/**
 * A notification which does not expect a response.
 */
export const JSONRPCNotificationSchema = Type.Interface(
    [NotificationSchema],
    {
        jsonrpc: Type.Literal(JSONRPC_VERSION)
    },
    {
        additionalProperties: false
    }
);

export const isJSONRPCNotification = (value: unknown): value is JSONRPCNotification => Value.Check(JSONRPCNotificationSchema, value);

/**
 * A successful (non-error) response to a request.
 */
export const JSONRPCResponseSchema = Type.Object(
    {
        jsonrpc: Type.Literal(JSONRPC_VERSION),
        id: RequestIdSchema,
        result: ResultSchema
    },
    {
        additionalProperties: false
    }
);

export const isJSONRPCResponse = (value: unknown): value is JSONRPCResponse => Value.Check(JSONRPCResponseSchema, value);

/**
 * Error codes defined by the JSON-RPC specification.
 */
export enum ErrorCode {
    // SDK error codes
    ConnectionClosed = -32000,
    RequestTimeout = -32001,

    // Standard JSON-RPC error codes
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603
}

/**
 * A response to a request that indicates an error occurred.
 */
export const JSONRPCErrorSchema = Type.Object(
    {
        jsonrpc: Type.Literal(JSONRPC_VERSION),
        id: RequestIdSchema,
        error: Type.Object({
            /**
             * The error type that occurred.
             */
            code: Type.Integer(),
            /**
             * A short description of the error. The message SHOULD be limited to a concise single sentence.
             */
            message: Type.String(),
            /**
             * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
             */
            data: Type.Optional(Type.Unknown())
        })
    },
    {
        additionalProperties: false
    }
);

export const isJSONRPCError = (value: unknown): value is JSONRPCError => Value.Check(JSONRPCErrorSchema, value);

export const JSONRPCMessageSchema = Type.Union([
    JSONRPCRequestSchema,
    JSONRPCNotificationSchema,
    JSONRPCResponseSchema,
    JSONRPCErrorSchema
]);

/* Empty result */
/**
 * A response that indicates success but carries no data.
 */
export const EmptyResultSchema = Type.Options(ResultSchema, { additionalProperties: false });

/* Cancellation */
/**
 * This notification can be sent by either side to indicate that it is cancelling a previously-issued request.
 *
 * The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished.
 *
 * This notification indicates that the result will be unused, so any associated processing SHOULD cease.
 *
 * A client MUST NOT attempt to cancel its `initialize` request.
 */
export const CancelledNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/cancelled'),
    params: Type.Interface([BaseNotificationParamsSchema], {
        /**
         * The ID of the request to cancel.
         *
         * This MUST correspond to the ID of a request previously issued in the same direction.
         */
        requestId: RequestIdSchema,

        /**
         * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
         */
        reason: Type.Optional(Type.String())
    })
});

/* Base Metadata */
/**
 * Icon schema for use in tools, prompts, resources, and implementations.
 */
export const IconSchema = Type.Object({
    /**
     * URL or data URI for the icon.
     */
    src: Type.String(),
    /**
     * Optional MIME type for the icon.
     */
    mimeType: Type.Optional(Type.String()),
    /**
     * Optional array of strings that specify sizes at which the icon can be used.
     * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
     *
     * If not provided, the client should assume that the icon can be used at any size.
     */
    sizes: Type.Optional(Type.Array(Type.String()))
});

/**
 * Base schema to add `icons` property.
 *
 */
export const IconsSchema = Type.Object({
    /**
     * Optional set of sized icons that the client can display in a user interface.
     *
     * Clients that support rendering icons MUST support at least the following MIME types:
     * - `image/png` - PNG images (safe, universal compatibility)
     * - `image/jpeg` (and `image/jpg`) - JPEG images (safe, universal compatibility)
     *
     * Clients that support rendering icons SHOULD also support:
     * - `image/svg+xml` - SVG images (scalable but requires security precautions)
     * - `image/webp` - WebP images (modern, efficient format)
     */
    icons: Type.Optional(Type.Array(IconSchema))
});

/**
 * Base metadata interface for common properties across resources, tools, prompts, and implementations.
 */
export const BaseMetadataSchema = Type.Object({
    /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
    name: Type.String(),
    /**
     * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
     * even by those unfamiliar with domain-specific terminology.
     *
     * If not provided, the name should be used for display (except for Tool,
     * where `annotations.title` should be given precedence over using `name`,
     * if present).
     */
    title: Type.Optional(Type.String())
});

/* Initialization */
/**
 * Describes the name and version of an MCP implementation.
 */
export const ImplementationSchema = Type.Interface([BaseMetadataSchema, IconsSchema], {
    version: Type.String(),
    /**
     * An optional URL of the website for this implementation.
     */
    websiteUrl: Type.Optional(Type.String())
});

/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 */
export const ClientCapabilitiesSchema = Type.Object({
    /**
     * Experimental, non-standard capabilities that the client supports.
     */
    experimental: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    /**
     * Present if the client supports sampling from an LLM.
     */
    sampling: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    /**
     * Present if the client supports eliciting user input.
     */
    elicitation: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    /**
     * Present if the client supports listing roots.
     */
    roots: Type.Optional(
        Type.Object({
            /**
             * Whether the client supports issuing notifications for changes to the roots list.
             */
            listChanged: Type.Optional(Type.Boolean())
        })
    )
});

/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
export const InitializeRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('initialize'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
         */
        protocolVersion: Type.String(),
        capabilities: ClientCapabilitiesSchema,
        clientInfo: ImplementationSchema
    })
});

export const isInitializeRequest = (value: unknown): value is InitializeRequest => Value.Check(InitializeRequestSchema, value);

/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 */
export const ServerCapabilitiesSchema = Type.Object({
    /**
     * Experimental, non-standard capabilities that the server supports.
     */
    experimental: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    /**
     * Present if the server supports sending log messages to the client.
     */
    logging: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    /**
     * Present if the server supports sending completions to the client.
     */
    completions: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    /**
     * Present if the server offers any prompt templates.
     */
    prompts: Type.Optional(
        Type.Object({
            /**
             * Whether this server supports issuing notifications for changes to the prompt list.
             */
            listChanged: Type.Optional(Type.Boolean())
        })
    ),
    /**
     * Present if the server offers any resources to read.
     */
    resources: Type.Optional(
        Type.Object({
            /**
             * Whether this server supports clients subscribing to resource updates.
             */
            subscribe: Type.Optional(Type.Boolean()),

            /**
             * Whether this server supports issuing notifications for changes to the resource list.
             */
            listChanged: Type.Optional(Type.Boolean())
        })
    ),
    /**
     * Present if the server offers any tools to call.
     */
    tools: Type.Optional(
        Type.Object({
            /**
             * Whether this server supports issuing notifications for changes to the tool list.
             */
            listChanged: Type.Optional(Type.Boolean())
        })
    )
});

/**
 * After receiving an initialize request from the client, the server sends this response.
 */
export const InitializeResultSchema = Type.Interface([ResultSchema], {
    /**
     * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
     */
    protocolVersion: Type.String(),
    capabilities: ServerCapabilitiesSchema,
    serverInfo: ImplementationSchema,
    /**
     * Instructions describing how to use the server and its features.
     *
     * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
     */
    instructions: Type.Optional(Type.String())
});

/**
 * This notification is sent from the client to the server after initialization has finished.
 */
export const InitializedNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/initialized')
});

export const isInitializedNotification = (value: unknown): value is InitializedNotification =>
    Value.Check(InitializedNotificationSchema, value);

/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
 */
export const PingRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('ping')
});

/* Progress notifications */
export const ProgressSchema = Type.Object({
    /**
     * The progress thus far. This should increase every time progress is made, even if the total is unknown.
     */
    progress: Type.Number(),
    /**
     * Total number of items to process (or total progress required), if known.
     */
    total: Type.Optional(Type.Number()),
    /**
     * An optional message describing the current progress.
     */
    message: Type.Optional(Type.String())
});

/**
 * An out-of-band notification used to inform the receiver of a progress update for a long-running request.
 */
export const ProgressNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/progress'),
    params: Type.Interface([BaseNotificationParamsSchema, ProgressSchema], {
        /**
         * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
         */
        progressToken: ProgressTokenSchema
    })
});

/* Pagination */
export const PaginatedRequestSchema = Type.Interface([RequestSchema], {
    params: Type.Optional(
        Type.Interface([BaseRequestParamsSchema], {
            /**
             * An opaque token representing the current pagination position.
             * If provided, the server should return results starting after this cursor.
             */
            cursor: Type.Optional(CursorSchema)
        })
    )
});

export const PaginatedResultSchema = Type.Interface([ResultSchema], {
    /**
     * An opaque token representing the pagination position after the last returned result.
     * If present, there may be more results available.
     */
    nextCursor: Type.Optional(CursorSchema)
});

/* Resources */
/**
 * The contents of a specific resource or sub-resource.
 */
export const ResourceContentsSchema = Type.Object({
    /**
     * The URI of this resource.
     */
    uri: Type.String(),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: Type.Optional(Type.String()),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

export const TextResourceContentsSchema = Type.Interface([ResourceContentsSchema], {
    /**
     * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
     */
    text: Type.String()
});

/**
 * A Zod schema for validating Base64 strings that is more performant and
 * robust for very large inputs than the default regex-based check. It avoids
 * stack overflows by using the native `atob` function for validation.
 */
const Base64Schema = Type.String({ format: 'base64' });

export const BlobResourceContentsSchema = Type.Interface([ResourceContentsSchema], {
    /**
     * A base64-encoded string representing the binary data of the item.
     */
    blob: Base64Schema
});

/**
 * A known resource that the server is capable of reading.
 */
export const ResourceSchema = Type.Interface([BaseMetadataSchema, IconsSchema], {
    /**
     * The URI of this resource.
     */
    uri: Type.String(),

    /**
     * A description of what this resource represents.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: Type.Optional(Type.String()),

    /**
     * The MIME type of this resource, if known.
     */
    mimeType: Type.Optional(Type.String()),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * A template description for resources available on the server.
 */
export const ResourceTemplateSchema = Type.Interface([BaseMetadataSchema, IconsSchema], {
    /**
     * A URI template (according to RFC 6570) that can be used to construct resource URIs.
     */
    uriTemplate: Type.String(),

    /**
     * A description of what this template is for.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
    description: Type.Optional(Type.String()),

    /**
     * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
     */
    mimeType: Type.Optional(Type.String()),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * Sent from the client to request a list of resources the server has.
 */
export const ListResourcesRequestSchema = Type.Interface([PaginatedRequestSchema], {
    method: Type.Literal('resources/list')
});

/**
 * The server's response to a resources/list request from the client.
 */
export const ListResourcesResultSchema = Type.Interface([PaginatedResultSchema], {
    resources: Type.Array(ResourceSchema)
});

/**
 * Sent from the client to request a list of resource templates the server has.
 */
export const ListResourceTemplatesRequestSchema = Type.Interface([PaginatedRequestSchema], {
    method: Type.Literal('resources/templates/list')
});

/**
 * The server's response to a resources/templates/list request from the client.
 */
export const ListResourceTemplatesResultSchema = Type.Interface([PaginatedResultSchema], {
    resourceTemplates: Type.Array(ResourceTemplateSchema)
});

/**
 * Sent from the client to the server, to read a specific resource URI.
 */
export const ReadResourceRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('resources/read'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: Type.String()
    })
});

/**
 * The server's response to a resources/read request from the client.
 */
export const ReadResourceResultSchema = Type.Interface([ResultSchema], {
    contents: Type.Array(Type.Union([TextResourceContentsSchema, BlobResourceContentsSchema]))
});

/**
 * An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
 */
export const ResourceListChangedNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/resources/list_changed')
});

/**
 * Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
 */
export const SubscribeRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('resources/subscribe'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
         */
        uri: Type.String()
    })
});

/**
 * Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
 */
export const UnsubscribeRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('resources/unsubscribe'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The URI of the resource to unsubscribe from.
         */
        uri: Type.String()
    })
});

/**
 * A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
 */
export const ResourceUpdatedNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/resources/updated'),
    params: Type.Interface([BaseNotificationParamsSchema], {
        /**
         * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
         */
        uri: Type.String()
    })
});

/* Prompts */
/**
 * Describes an argument that a prompt can accept.
 */
export const PromptArgumentSchema = Type.Object({
    /**
     * The name of the argument.
     */
    name: Type.String(),
    /**
     * A human-readable description of the argument.
     */
    description: Type.Optional(Type.String()),
    /**
     * Whether this argument must be provided.
     */
    required: Type.Optional(Type.Boolean())
});

/**
 * A prompt or prompt template that the server offers.
 */
export const PromptSchema = Type.Interface([BaseMetadataSchema, IconsSchema], {
    /**
     * An optional description of what this prompt provides
     */
    description: Type.Optional(Type.String()),
    /**
     * A list of arguments to use for templating the prompt.
     */
    arguments: Type.Optional(Type.Array(PromptArgumentSchema)),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 */
export const ListPromptsRequestSchema = Type.Interface([PaginatedRequestSchema], {
    method: Type.Literal('prompts/list')
});

/**
 * The server's response to a prompts/list request from the client.
 */
export const ListPromptsResultSchema = Type.Interface([PaginatedResultSchema], {
    prompts: Type.Array(PromptSchema)
});

/**
 * Used by the client to get a prompt provided by the server.
 */
export const GetPromptRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('prompts/get'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The name of the prompt or prompt template.
         */
        name: Type.String(),
        /**
         * Arguments to use for templating the prompt.
         */
        arguments: Type.Optional(Type.Record(Type.String(), Type.String()))
    })
});

/**
 * Text provided to or from an LLM.
 */
export const TextContentSchema = Type.Object({
    type: Type.Literal('text'),
    /**
     * The text content of the message.
     */
    text: Type.String(),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * An image provided to or from an LLM.
 */
export const ImageContentSchema = Type.Object({
    type: Type.Literal('image'),
    /**
     * The base64-encoded image data.
     */
    data: Base64Schema,
    /**
     * The MIME type of the image. Different providers may support different image types.
     */
    mimeType: Type.String(),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * An Audio provided to or from an LLM.
 */
export const AudioContentSchema = Type.Object({
    type: Type.Literal('audio'),
    /**
     * The base64-encoded audio data.
     */
    data: Base64Schema,
    /**
     * The MIME type of the audio. Different providers may support different audio types.
     */
    mimeType: Type.String(),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * The contents of a resource, embedded into a prompt or tool call result.
 */
export const EmbeddedResourceSchema = Type.Object({
    type: Type.Literal('resource'),
    resource: Type.Union([TextResourceContentsSchema, BlobResourceContentsSchema]),
    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 *
 * Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.
 */
export const ResourceLinkSchema = Type.Interface([ResourceSchema], {
    type: Type.Literal('resource_link')
});

/**
 * A content block that can be used in prompts and tool results.
 */
export const ContentBlockSchema = Type.Union([
    TextContentSchema,
    ImageContentSchema,
    AudioContentSchema,
    ResourceLinkSchema,
    EmbeddedResourceSchema
]);

/**
 * Describes a message returned as part of a prompt.
 */
export const PromptMessageSchema = Type.Object({
    role: Type.Enum(['user', 'assistant']),
    content: ContentBlockSchema
});

/**
 * The server's response to a prompts/get request from the client.
 */
export const GetPromptResultSchema = Type.Interface([ResultSchema], {
    /**
     * An optional description for the prompt.
     */
    description: Type.Optional(Type.String()),
    messages: Type.Array(PromptMessageSchema)
});

/**
 * An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export const PromptListChangedNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/prompts/list_changed')
});

/* Tools */
/**
 * Additional properties describing a Tool to clients.
 *
 * NOTE: all properties in ToolAnnotations are **hints**.
 * They are not guaranteed to provide a faithful description of
 * tool behavior (including descriptive properties like `title`).
 *
 * Clients should never make tool use decisions based on ToolAnnotations
 * received from untrusted servers.
 */
export const ToolAnnotationsSchema = Type.Object({
    /**
     * A human-readable title for the tool.
     */
    title: Type.Optional(Type.String()),

    /**
     * If true, the tool does not modify its environment.
     *
     * Default: false
     */
    readOnlyHint: Type.Optional(Type.Boolean()),

    /**
     * If true, the tool may perform destructive updates to its environment.
     * If false, the tool performs only additive updates.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: true
     */
    destructiveHint: Type.Optional(Type.Boolean()),

    /**
     * If true, calling the tool repeatedly with the same arguments
     * will have no additional effect on the its environment.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: false
     */
    idempotentHint: Type.Optional(Type.Boolean()),

    /**
     * If true, this tool may interact with an "open world" of external
     * entities. If false, the tool's domain of interaction is closed.
     * For example, the world of a web search tool is open, whereas that
     * of a memory tool is not.
     *
     * Default: true
     */
    openWorldHint: Type.Optional(Type.Boolean())
});

/**
 * Definition for a tool the client can call.
 */
export const ToolSchema = Type.Interface([BaseMetadataSchema, IconsSchema], {
    /**
     * A human-readable description of the tool.
     */
    description: Type.Optional(Type.String()),
    /**
     * A JSON Schema object defining the expected parameters for the tool.
     */
    inputSchema: Type.Object({
        type: Type.Literal('object'),
        properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        required: Type.Optional(Type.Array(Type.String()))
    }),
    /**
     * An optional JSON Schema object defining the structure of the tool's output returned in
     * the structuredContent field of a CallToolResult.
     */
    outputSchema: Type.Optional(
        Type.Object({
            type: Type.Literal('object'),
            properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
            required: Type.Optional(Type.Array(Type.String()))
        })
    ),
    /**
     * Optional additional tool information.
     */
    annotations: Type.Optional(ToolAnnotationsSchema),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * Sent from the client to request a list of tools the server has.
 */
export const ListToolsRequestSchema = Type.Interface([PaginatedRequestSchema], {
    method: Type.Literal('tools/list')
});

/**
 * The server's response to a tools/list request from the client.
 */
export const ListToolsResultSchema = Type.Interface([PaginatedResultSchema], {
    tools: Type.Array(ToolSchema)
});

/**
 * The server's response to a tool call.
 */
export const CallToolResultSchema = Type.Interface([ResultSchema], {
    /**
     * A list of content objects that represent the result of the tool call.
     *
     * If the Tool does not define an outputSchema, this field MUST be present in the result.
     * For backwards compatibility, this field is always present, but it may be empty.
     */
    content: Type.Array(ContentBlockSchema, { default: [] }),

    /**
     * An object containing structured tool output.
     *
     * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
     */
    structuredContent: Type.Optional(Type.Record(Type.String(), Type.Unknown())),

    /**
     * Whether the tool call ended in an error.
     *
     * If not set, this is assumed to be false (the call was successful).
     *
     * Any errors that originate from the tool SHOULD be reported inside the result
     * object, with `isError` set to true, _not_ as an MCP protocol-level error
     * response. Otherwise, the LLM would not be able to see that an error occurred
     * and self-correct.
     *
     * However, any errors in _finding_ the tool, an error indicating that the
     * server does not support tool calls, or any other exceptional conditions,
     * should be reported as an MCP error response.
     */
    isError: Type.Optional(Type.Boolean())
});

/**
 * CallToolResultSchema extended with backwards compatibility to protocol version 2024-10-07.
 */
export const CompatibilityCallToolResultSchema = Type.Union([
    CallToolResultSchema,
    Type.Interface([ResultSchema], { toolResult: Type.Unknown() })
]);

/**
 * Used by the client to invoke a tool provided by the server.
 */
export const CallToolRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('tools/call'),
    params: Type.Interface([BaseRequestParamsSchema], {
        name: Type.String(),
        arguments: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
    })
});

/**
 * An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export const ToolListChangedNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/tools/list_changed')
});

/* Logging */
/**
 * The severity of a log message.
 */
export const LoggingLevelSchema = Type.Enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']);

/**
 * A request from the client to the server, to enable or adjust logging.
 */
export const SetLevelRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('logging/setLevel'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
         */
        level: LoggingLevelSchema
    })
});

/**
 * Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
 */
export const LoggingMessageNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/message'),
    params: Type.Interface([BaseNotificationParamsSchema], {
        /**
         * The severity of this log message.
         */
        level: LoggingLevelSchema,
        /**
         * An optional name of the logger issuing this message.
         */
        logger: Type.Optional(Type.String()),
        /**
         * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
         */
        data: Type.Unknown()
    })
});

/* Sampling */
/**
 * Hints to use for model selection.
 */
export const ModelHintSchema = Type.Object({
    /**
     * A hint for a model name.
     */
    name: Type.Optional(Type.String())
});

/**
 * The server's preferences for model selection, requested of the client during sampling.
 */
export const ModelPreferencesSchema = Type.Object({
    /**
     * Optional hints to use for model selection.
     */
    hints: Type.Optional(Type.Array(ModelHintSchema)),
    /**
     * How much to prioritize cost when selecting a model.
     */
    costPriority: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    /**
     * How much to prioritize sampling speed (latency) when selecting a model.
     */
    speedPriority: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    /**
     * How much to prioritize intelligence and capabilities when selecting a model.
     */
    intelligencePriority: Type.Optional(Type.Number({ minimum: 0, maximum: 1 }))
});

/**
 * Describes a message issued to or received from an LLM API.
 */
export const SamplingMessageSchema = Type.Object({
    role: Type.Enum(['user', 'assistant']),
    content: Type.Union([TextContentSchema, ImageContentSchema, AudioContentSchema])
});

/**
 * A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
 */
export const CreateMessageRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('sampling/createMessage'),
    params: Type.Interface([BaseRequestParamsSchema], {
        messages: Type.Array(SamplingMessageSchema),
        /**
         * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
         */
        systemPrompt: Type.Optional(Type.String()),
        /**
         * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
         */
        includeContext: Type.Optional(Type.Enum(['none', 'thisServer', 'allServers'])),
        temperature: Type.Optional(Type.Number()),
        /**
         * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
         */
        maxTokens: Type.Integer(),
        stopSequences: Type.Optional(Type.Array(Type.String())),
        /**
         * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
         */
        metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        /**
         * The server's preferences for which model to select.
         */
        modelPreferences: Type.Optional(ModelPreferencesSchema)
    })
});

/**
 * The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.
 */
export const CreateMessageResultSchema = Type.Interface([ResultSchema], {
    /**
     * The name of the model that generated the message.
     */
    model: Type.String(),
    /**
     * The reason why sampling stopped.
     */
    stopReason: Type.Optional(Type.Union([Type.Enum(['endTurn', 'stopSequence', 'maxTokens']), Type.String()])),
    role: Type.Enum(['user', 'assistant']),
    content: Type.Union([TextContentSchema, ImageContentSchema, AudioContentSchema], {
        discriminator: 'type' // non-standard descriptive metadata only
    })
});

/* Elicitation */
/**
 * Primitive schema definition for boolean fields.
 */
export const BooleanSchemaSchema = Type.Object({
    type: Type.Literal('boolean'),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    default: Type.Optional(Type.Boolean())
});

/**
 * Primitive schema definition for string fields.
 */
export const StringSchemaSchema = Type.Object({
    type: Type.Literal('string'),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    minLength: Type.Optional(Type.Number()),
    maxLength: Type.Optional(Type.Number()),
    format: Type.Optional(Type.Enum(['email', 'uri', 'date', 'date-time']))
});

/**
 * Primitive schema definition for number fields.
 */
export const NumberSchemaSchema = Type.Object({
    type: Type.Enum(['number', 'integer']),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    minimum: Type.Optional(Type.Number()),
    maximum: Type.Optional(Type.Number())
});

/**
 * Primitive schema definition for enum fields.
 */
export const EnumSchemaSchema = Type.Object({
    type: Type.Literal('string'),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    enum: Type.Array(Type.String()),
    enumNames: Type.Optional(Type.Array(Type.String()))
});

/**
 * Union of all primitive schema definitions.
 */
export const PrimitiveSchemaDefinitionSchema = Type.Union([BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema, EnumSchemaSchema]);

/**
 * A request from the server to elicit user input via the client.
 * The client should present the message and form fields to the user.
 */
export const ElicitRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('elicitation/create'),
    params: Type.Interface([BaseRequestParamsSchema], {
        /**
         * The message to present to the user.
         */
        message: Type.String(),
        /**
         * The schema for the requested user input.
         */
        requestedSchema: Type.Object({
            type: Type.Literal('object'),
            properties: Type.Record(Type.String(), PrimitiveSchemaDefinitionSchema),
            required: Type.Optional(Type.Array(Type.String()))
        })
    })
});

/**
 * The client's response to an elicitation/create request from the server.
 */
export const ElicitResultSchema = Type.Interface([ResultSchema], {
    /**
     * The user's response action.
     */
    action: Type.Enum(['accept', 'decline', 'cancel']),
    /**
     * The collected user input content (only present if action is "accept").
     */
    content: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/* Autocomplete */
/**
 * A reference to a resource or resource template definition.
 */
export const ResourceTemplateReferenceSchema = Type.Object({
    type: Type.Literal('ref/resource'),
    /**
     * The URI or URI template of the resource.
     */
    uri: Type.String()
});

/**
 * @deprecated Use ResourceTemplateReferenceSchema instead
 */
export const ResourceReferenceSchema = ResourceTemplateReferenceSchema;

/**
 * Identifies a prompt.
 */
export const PromptReferenceSchema = Type.Object({
    type: Type.Literal('ref/prompt'),
    /**
     * The name of the prompt or prompt template
     */
    name: Type.String()
});

/**
 * A request from the client to the server, to ask for completion options.
 */
export const CompleteRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('completion/complete'),
    params: Type.Interface([BaseRequestParamsSchema], {
        ref: Type.Union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
        /**
         * The argument's information
         */
        argument: Type.Object({
            /**
             * The name of the argument
             */
            name: Type.String(),
            /**
             * The value of the argument to use for completion matching.
             */
            value: Type.String()
        }),
        context: Type.Optional(
            Type.Object({
                /**
                 * Previously-resolved variables in a URI template or prompt.
                 */
                arguments: Type.Optional(Type.Record(Type.String(), Type.String()))
            })
        )
    })
});

/**
 * The server's response to a completion/complete request
 */
export const CompleteResultSchema = Type.Interface([ResultSchema], {
    completion: Type.Object({
        /**
         * An array of completion values. Must not exceed 100 items.
         */
        values: Type.Array(Type.String({ maxLength: 100 })),
        /**
         * The total number of completion options available. This can exceed the number of values actually sent in the response.
         */
        total: Type.Optional(Type.Integer()),
        /**
         * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
         */
        hasMore: Type.Optional(Type.Boolean())
    })
});

/* Roots */
/**
 * Represents a root directory or file that the server can operate on.
 */
export const RootSchema = Type.Object({
    /**
     * The URI identifying the root. This *must* start with file:// for now.
     */
    uri: Type.String({ format: 'uri' }),
    /**
     * An optional name for the root.
     */
    name: Type.Optional(Type.String()),

    /**
     * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
     * for notes on _meta usage.
     */
    _meta: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
});

/**
 * Sent from the server to request a list of root URIs from the client.
 */
export const ListRootsRequestSchema = Type.Interface([RequestSchema], {
    method: Type.Literal('roots/list')
});

/**
 * The client's response to a roots/list request from the server.
 */
export const ListRootsResultSchema = Type.Interface([ResultSchema], {
    roots: Type.Array(RootSchema)
});

/**
 * A notification from the client to the server, informing it that the list of roots has changed.
 */
export const RootsListChangedNotificationSchema = Type.Interface([NotificationSchema], {
    method: Type.Literal('notifications/roots/list_changed')
});

/* Client messages */
export const ClientRequestSchema = Type.Union([
    PingRequestSchema,
    InitializeRequestSchema,
    CompleteRequestSchema,
    SetLevelRequestSchema,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    SubscribeRequestSchema,
    UnsubscribeRequestSchema,
    CallToolRequestSchema,
    ListToolsRequestSchema
]);

export const ClientNotificationSchema = Type.Union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    InitializedNotificationSchema,
    RootsListChangedNotificationSchema
]);

export const ClientResultSchema = Type.Union([EmptyResultSchema, CreateMessageResultSchema, ElicitResultSchema, ListRootsResultSchema]);

/* Server messages */
export const ServerRequestSchema = Type.Union([PingRequestSchema, CreateMessageRequestSchema, ElicitRequestSchema, ListRootsRequestSchema]);

export const ServerNotificationSchema = Type.Union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    LoggingMessageNotificationSchema,
    ResourceUpdatedNotificationSchema,
    ResourceListChangedNotificationSchema,
    ToolListChangedNotificationSchema,
    PromptListChangedNotificationSchema
]);

export const ServerResultSchema = Type.Union([
    EmptyResultSchema,
    InitializeResultSchema,
    CompleteResultSchema,
    GetPromptResultSchema,
    ListPromptsResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ReadResourceResultSchema,
    CallToolResultSchema,
    ListToolsResultSchema
]);

export class McpError extends Error {
    constructor(
        public readonly code: number,
        message: string,
        public readonly data?: unknown
    ) {
        super(`MCP error ${code}: ${message}`);
        this.name = 'McpError';
    }
}

/**
 * Headers that are compatible with both Node.js and the browser.
 */
export type IsomorphicHeaders = Record<string, string | string[] | undefined>;

/**
 * Information about the incoming request.
 */
export interface RequestInfo {
    /**
     * The headers of the request.
     */
    headers: IsomorphicHeaders;
}

/**
 * Extra information about a message.
 */
export interface MessageExtraInfo {
    /**
     * The request information.
     */
    requestInfo?: RequestInfo;

    /**
     * The authentication information.
     */
    authInfo?: AuthInfo;
}

/* JSON-RPC types */
export type ProgressToken = Type.Static<typeof ProgressTokenSchema>;
export type Cursor = Type.Static<typeof CursorSchema>;
export type Request = Type.Static<typeof RequestSchema>;
export type RequestMeta = Type.Static<typeof RequestMetaSchema>;
export type Notification = Type.Static<typeof NotificationSchema>;
export type Result = Type.Static<typeof ResultSchema>;
export type RequestId = Type.Static<typeof RequestIdSchema>;
export type JSONRPCRequest = Type.Static<typeof JSONRPCRequestSchema>;
export type JSONRPCNotification = Type.Static<typeof JSONRPCNotificationSchema>;
export type JSONRPCResponse = Type.Static<typeof JSONRPCResponseSchema>;
export type JSONRPCError = Type.Static<typeof JSONRPCErrorSchema>;
export type JSONRPCMessage = Type.Static<typeof JSONRPCMessageSchema>;

/* Empty result */
export type EmptyResult = Type.Static<typeof EmptyResultSchema>;

/* Cancellation */
export type CancelledNotification = Type.Static<typeof CancelledNotificationSchema>;

/* Base Metadata */
export type Icon = Type.Static<typeof IconSchema>;
export type Icons = Type.Static<typeof IconsSchema>;
export type BaseMetadata = Type.Static<typeof BaseMetadataSchema>;

/* Initialization */
export type Implementation = Type.Static<typeof ImplementationSchema>;
export type ClientCapabilities = Type.Static<typeof ClientCapabilitiesSchema>;
export type InitializeRequest = Type.Static<typeof InitializeRequestSchema>;
export type ServerCapabilities = Type.Static<typeof ServerCapabilitiesSchema>;
export type InitializeResult = Type.Static<typeof InitializeResultSchema>;
export type InitializedNotification = Type.Static<typeof InitializedNotificationSchema>;

/* Ping */
export type PingRequest = Type.Static<typeof PingRequestSchema>;

/* Progress notifications */
export type Progress = Type.Static<typeof ProgressSchema>;
export type ProgressNotification = Type.Static<typeof ProgressNotificationSchema>;

/* Pagination */
export type PaginatedRequest = Type.Static<typeof PaginatedRequestSchema>;
export type PaginatedResult = Type.Static<typeof PaginatedResultSchema>;

/* Resources */
export type ResourceContents = Type.Static<typeof ResourceContentsSchema>;
export type TextResourceContents = Type.Static<typeof TextResourceContentsSchema>;
export type BlobResourceContents = Type.Static<typeof BlobResourceContentsSchema>;
export type Resource = Type.Static<typeof ResourceSchema>;
export type ResourceTemplate = Type.Static<typeof ResourceTemplateSchema>;
export type ListResourcesRequest = Type.Static<typeof ListResourcesRequestSchema>;
export type ListResourcesResult = Type.Static<typeof ListResourcesResultSchema>;
export type ListResourceTemplatesRequest = Type.Static<typeof ListResourceTemplatesRequestSchema>;
export type ListResourceTemplatesResult = Type.Static<typeof ListResourceTemplatesResultSchema>;
export type ReadResourceRequest = Type.Static<typeof ReadResourceRequestSchema>;
export type ReadResourceResult = Type.Static<typeof ReadResourceResultSchema>;
export type ResourceListChangedNotification = Type.Static<typeof ResourceListChangedNotificationSchema>;
export type SubscribeRequest = Type.Static<typeof SubscribeRequestSchema>;
export type UnsubscribeRequest = Type.Static<typeof UnsubscribeRequestSchema>;
export type ResourceUpdatedNotification = Type.Static<typeof ResourceUpdatedNotificationSchema>;

/* Prompts */
export type PromptArgument = Type.Static<typeof PromptArgumentSchema>;
export type Prompt = Type.Static<typeof PromptSchema>;
export type ListPromptsRequest = Type.Static<typeof ListPromptsRequestSchema>;
export type ListPromptsResult = Type.Static<typeof ListPromptsResultSchema>;
export type GetPromptRequest = Type.Static<typeof GetPromptRequestSchema>;
export type TextContent = Type.Static<typeof TextContentSchema>;
export type ImageContent = Type.Static<typeof ImageContentSchema>;
export type AudioContent = Type.Static<typeof AudioContentSchema>;
export type EmbeddedResource = Type.Static<typeof EmbeddedResourceSchema>;
export type ResourceLink = Type.Static<typeof ResourceLinkSchema>;
export type ContentBlock = Type.Static<typeof ContentBlockSchema>;
export type PromptMessage = Type.Static<typeof PromptMessageSchema>;
export type GetPromptResult = Type.Static<typeof GetPromptResultSchema>;
export type PromptListChangedNotification = Type.Static<typeof PromptListChangedNotificationSchema>;

/* Tools */
export type ToolAnnotations = Type.Static<typeof ToolAnnotationsSchema>;
export type Tool = Type.Static<typeof ToolSchema>;
export type ListToolsRequest = Type.Static<typeof ListToolsRequestSchema>;
export type ListToolsResult = Type.Static<typeof ListToolsResultSchema>;
export type CallToolResult = Type.Static<typeof CallToolResultSchema>;
export type CompatibilityCallToolResult = Type.Static<typeof CompatibilityCallToolResultSchema>;
export type CallToolRequest = Type.Static<typeof CallToolRequestSchema>;
export type ToolListChangedNotification = Type.Static<typeof ToolListChangedNotificationSchema>;

/* Logging */
export type LoggingLevel = Type.Static<typeof LoggingLevelSchema>;
export type SetLevelRequest = Type.Static<typeof SetLevelRequestSchema>;
export type LoggingMessageNotification = Type.Static<typeof LoggingMessageNotificationSchema>;

/* Sampling */
export type SamplingMessage = Type.Static<typeof SamplingMessageSchema>;
export type CreateMessageRequest = Type.Static<typeof CreateMessageRequestSchema>;
export type CreateMessageResult = Type.Static<typeof CreateMessageResultSchema>;

/* Elicitation */
export type BooleanSchema = Type.Static<typeof BooleanSchemaSchema>;
export type StringSchema = Type.Static<typeof StringSchemaSchema>;
export type NumberSchema = Type.Static<typeof NumberSchemaSchema>;
export type EnumSchema = Type.Static<typeof EnumSchemaSchema>;
export type PrimitiveSchemaDefinition = Type.Static<typeof PrimitiveSchemaDefinitionSchema>;
export type ElicitRequest = Type.Static<typeof ElicitRequestSchema>;
export type ElicitResult = Type.Static<typeof ElicitResultSchema>;

/* Autocomplete */
export type ResourceTemplateReference = Type.Static<typeof ResourceTemplateReferenceSchema>;
/**
 * @deprecated Use ResourceTemplateReference instead
 */
export type ResourceReference = ResourceTemplateReference;
export type PromptReference = Type.Static<typeof PromptReferenceSchema>;
export type CompleteRequest = Type.Static<typeof CompleteRequestSchema>;
export type CompleteResult = Type.Static<typeof CompleteResultSchema>;

/* Roots */
export type Root = Type.Static<typeof RootSchema>;
export type ListRootsRequest = Type.Static<typeof ListRootsRequestSchema>;
export type ListRootsResult = Type.Static<typeof ListRootsResultSchema>;
export type RootsListChangedNotification = Type.Static<typeof RootsListChangedNotificationSchema>;

/* Client messages */
export type ClientRequest = Type.Static<typeof ClientRequestSchema>;
export type ClientNotification = Type.Static<typeof ClientNotificationSchema>;
export type ClientResult = Type.Static<typeof ClientResultSchema>;

/* Server messages */
export type ServerRequest = Type.Static<typeof ServerRequestSchema>;
export type ServerNotification = Type.Static<typeof ServerNotificationSchema>;
export type ServerResult = Type.Static<typeof ServerResultSchema>;
