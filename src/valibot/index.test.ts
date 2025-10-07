import { ValibotToJsonSchemaPlugin } from './index.js';
import { McpServer } from '../server/mcp.js';
import { CfWorkerJsonSchemaValidatorProvider } from '../cfworker/index.js';
import { Client } from '../client/index.js';
import { InMemoryTransport } from '../inMemory';
import { isTextContent, validateCallToolResult } from '@enth/mcp-specs/draft';
import { describe, it, expect } from 'vitest';
import * as v from 'valibot';

function newTestMcpServer() {
    return new McpServer(
        {
            name: 'test server',
            version: '1.0'
        },
        {
            capabilities: {},
            toJsonSchemaPlugins: [new ValibotToJsonSchemaPlugin()],
            jsonSchemaValidatorProvider: new CfWorkerJsonSchemaValidatorProvider()
        }
    );
}

function newTestClient() {
    return new Client({
        name: 'test client',
        version: '1.0'
    });
}

describe('ValibotToJsonSchemaPlugin', () => {
    it('should handle extends JSON Schema formats', async () => {
        const mcpServer = newTestMcpServer();
        const client = newTestClient();

        const testInputSchema = v.object({
            id: v.pipe(v.string(), v.uuid()),
            name: v.string(),
            age: v.pipe(v.number(), v.minValue(0)),
            email: v.pipe(v.string(), v.email()),
            homepage: v.pipe(v.string(), v.url()),
            icon: v.pipe(v.string(), v.base64()),
            pets: v.record(v.string(), v.picklist(['dog', 'cat', 'fish']))
        });
        type TestInput = v.InferInput<typeof testInputSchema>;

        const testOutputSchema = v.object({
            hasDogs: v.boolean()
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
