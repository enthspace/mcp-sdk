import { McpServer } from '../server/mcp.js';
import { Client } from '../client/index.js';
import { InMemoryTransport } from '../inMemory';
import { isTextContent, validateCallToolResult } from '@enth/mcp-specs/draft';
import { describe, it, expect } from 'vitest';
import type { Static } from 'typebox';
import { Type } from 'typebox';

import { ToolSchema } from '@enth/mcp-specs/draft';
import { TypeboxJsonSchemaValidatorProvider } from './index.js';
import type { Tool } from '@enth/mcp-specs/draft';
import type { JsonSchemaType } from '@enth/mcp-specs';

function newTestMcpServer() {
    return new McpServer(
        {
            name: 'test server',
            version: '1.0'
        },
        {
            capabilities: {},
            toJsonSchemaPlugins: [],
            jsonSchemaValidatorProvider: new TypeboxJsonSchemaValidatorProvider()
        }
    );
}

function newTestClient() {
    return new Client({
        name: 'test client',
        version: '1.0'
    });
}

describe('Typebox - no plugin needed', () => {
    it('should handle extends JSON Schema formats', async () => {
        const mcpServer = newTestMcpServer();
        const client = newTestClient();

        const testInputSchema = Type.Object({
            id: Type.String({ format: 'uuid' }),
            name: Type.String(),
            age: Type.Number({ minimum: 0 }),
            email: Type.String({ format: 'email' }),
            homepage: Type.String({ format: 'url' }),
            icon: Type.String({ format: 'base64' }),
            pets: Type.Record(Type.String(), Type.Enum(['dog', 'cat', 'fish']))
        });
        type TestInput = Static<typeof testInputSchema>;

        const testOutputSchema = Type.Object({
            hasDogs: Type.Boolean()
        });

        mcpServer.registerTool(
            'test',
            {
                description: 'Test tool with structured output',
                inputSchema: testInputSchema,
                outputSchema: testOutputSchema
            },
            async input => {
                const hasDogs = Object.values(input.pets).some(pet => pet === 'dog');
                return {
                    structuredContent: {
                        hasDogs
                    },
                    content: [
                        {
                            type: 'text',
                            text: hasDogs ? 'User has dogs' : 'User has no dogs'
                        }
                    ]
                };
            }
        );

        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        await Promise.all([client.connect(clientTransport), mcpServer.server.connect(serverTransport)]);

        // Call the tool and verify it returns valid structuredContent
        const result = await client.request(
            {
                method: 'tools/call',
                params: {
                    name: 'test',
                    arguments: {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        name: 'John Doe',
                        age: 33,
                        email: 'john.doe@example.com',
                        homepage: 'https://johndoe.com',
                        icon: 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=',
                        pets: {
                            Fido: 'dog',
                            Whiskers: 'cat'
                        }
                    } satisfies TestInput
                }
            },
            validateCallToolResult
        );

        expect(result.isError).toBe(undefined);
        expect(result.structuredContent).toStrictEqual({
            hasDogs: true
        });

        // For backward compatibility, content is auto-generated from structuredContent
        expect(result.content).toBeDefined();
        expect(result.content!).toHaveLength(1);
        expect(result.content![0]).toMatchObject({ type: 'text' });
        expect(isTextContent(result.content![0]) && result.content![0].text).toEqual('User has dogs');
    });
});

describe('TypeboxJsonSchemaValidatorProvider', () => {
    const validTool: Tool = {
        name: 'example-tool',
        description: 'An example tool',
        inputSchema: {
            type: 'object',
            properties: {
                foo: { type: 'string' },
                bar: { type: 'number' }
            },
            required: ['foo', 'bar']
        },
        outputSchema: {
            type: 'object',
            properties: {
                result: { type: 'string' }
            },
            required: ['result']
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
            readOnlyHint: false,
            title: 'Example Tool'
        }
    };

    it('should handle extends JSON Schema with refs', () => {
        const provider = new TypeboxJsonSchemaValidatorProvider();
        const validator = provider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);

        const result = validator(validTool);
        expect(result.valid).toBe(true);
        expect(result.data).toEqual(validTool);
    });
});
