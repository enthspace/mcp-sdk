import { describe, test, expect } from 'vitest';
import { SUPPORTED_PROTOCOL_VERSIONS } from './constants.js';
import { LATEST_PROTOCOL_VERSION } from '@enth/mcp-specs/draft';
import {
    ResourceLinkSchema,
    ContentBlockSchema,
    PromptMessageSchema,
    CallToolResultSchema,
    CompleteRequestSchema
} from './typebox/types.js';

import { type TSchema, type StaticParse } from 'typebox';
import Value from 'typebox/value';

import * as Ajv from 'ajv';
import ajvFormats from 'ajv-formats';

// -------------------------------------------------------------
// Emulate ZodParse with Ajv & TypeBox
//
// Emulates Zod behavior using Ajv and TypeBox to ensure assertion
// logic matches Zod and protocol types are directly compatible
// with JSON Schema validators.
//
// Target spec: JSON Schema Draft 7 and higher
//
// -------------------------------------------------------------
const ajv = ajvFormats(new Ajv.Ajv({ useDefaults: true }));
ajv.addFormat('base64', value => {
    try {
        atob(value);
        return true;
    } catch {
        return false;
    }
});
export function withAjv<const Type extends TSchema>(type: Type, value: unknown): { success: boolean; data: StaticParse<Type> } {
    const mutable = structuredClone(value);
    return ajv.validate(type, mutable) ? { success: true, data: mutable as never } : ({ success: false, data: value as never } as never);
}
export function withTypeBox<const Type extends TSchema>(type: Type, value: unknown): { success: boolean; data: StaticParse<Type> } {
    try {
        const parsed = Value.Parse(type, value);
        return { success: true, data: parsed };
    } catch {
        return { success: false, data: value } as never;
    }
}
// ------------------------------------------------------------------
// 2-phase check to ensure TypeBox and Ajv parse as same data.
// ------------------------------------------------------------------
export function safeParse<const Type extends TSchema>(type: Type, value: unknown): { success: boolean; data: StaticParse<Type> } {
    const result_0 = withAjv(type, value);
    const result_1 = withTypeBox(type, value);
    expect(result_0).toStrictEqual(result_1);
    return result_0;
}

describe('Types', () => {
    test('should have correct latest protocol version', () => {
        expect(LATEST_PROTOCOL_VERSION).toBeDefined();
        expect(LATEST_PROTOCOL_VERSION).toBe('DRAFT-2025-v3');
    });
    test('should have correct supported protocol versions', () => {
        expect(SUPPORTED_PROTOCOL_VERSIONS).toBeDefined();
        expect(SUPPORTED_PROTOCOL_VERSIONS).toBeInstanceOf(Array);
        expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(LATEST_PROTOCOL_VERSION);
        expect(SUPPORTED_PROTOCOL_VERSIONS).toContain('2024-11-05');
        expect(SUPPORTED_PROTOCOL_VERSIONS).toContain('2024-10-07');
        expect(SUPPORTED_PROTOCOL_VERSIONS).toContain('2025-03-26');
        expect(SUPPORTED_PROTOCOL_VERSIONS).toContain('2025-06-18');
    });

    describe('ResourceLink', () => {
        test('should validate a minimal ResourceLink', () => {
            const resourceLink = {
                type: 'resource_link',
                uri: 'file:///path/to/file.txt',
                name: 'file.txt'
            };

            const result = safeParse(ResourceLinkSchema, resourceLink);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('resource_link');
                expect(result.data.uri).toBe('file:///path/to/file.txt');
                expect(result.data.name).toBe('file.txt');
            }
        });

        test('should validate a ResourceLink with all optional fields', () => {
            const resourceLink = {
                type: 'resource_link',
                uri: 'https://example.com/resource',
                name: 'Example Resource',
                title: 'A comprehensive example resource',
                description: 'This resource demonstrates all fields',
                mimeType: 'text/plain',
                _meta: { custom: 'metadata' }
            };

            const result = safeParse(ResourceLinkSchema, resourceLink);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.title).toBe('A comprehensive example resource');
                expect(result.data.description).toBe('This resource demonstrates all fields');
                expect(result.data.mimeType).toBe('text/plain');
                expect(result.data._meta).toEqual({ custom: 'metadata' });
            }
        });

        test('should fail validation for invalid type', () => {
            const invalidResourceLink = {
                type: 'invalid_type',
                uri: 'file:///path/to/file.txt',
                name: 'file.txt'
            };

            const result = safeParse(ResourceLinkSchema, invalidResourceLink);
            expect(result.success).toBe(false);
        });

        test('should fail validation for missing required fields', () => {
            const invalidResourceLink = {
                type: 'resource_link',
                uri: 'file:///path/to/file.txt'
                // missing name
            };

            const result = safeParse(ResourceLinkSchema, invalidResourceLink);
            expect(result.success).toBe(false);
        });
    });

    describe('ContentBlock', () => {
        test('should validate text content', () => {
            const textContent = {
                type: 'text',
                text: 'Hello, world!'
            };

            const result = safeParse(ContentBlockSchema, textContent);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('text');
            }
        });

        test('should validate image content', () => {
            const imageContent = {
                type: 'image',
                data: 'aGVsbG8=', // base64 encoded "hello"
                mimeType: 'image/png'
            };

            const result = safeParse(ContentBlockSchema, imageContent);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('image');
            }
        });

        test('should validate audio content', () => {
            const audioContent = {
                type: 'audio',
                data: 'aGVsbG8=', // base64 encoded "hello"
                mimeType: 'audio/mp3'
            };

            const result = safeParse(ContentBlockSchema, audioContent);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('audio');
            }
        });

        test('should validate resource link content', () => {
            const resourceLink = {
                type: 'resource_link',
                uri: 'file:///path/to/file.txt',
                name: 'file.txt',
                mimeType: 'text/plain'
            };

            const result = safeParse(ContentBlockSchema, resourceLink);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('resource_link');
            }
        });

        test('should validate embedded resource content', () => {
            const embeddedResource = {
                type: 'resource',
                resource: {
                    uri: 'file:///path/to/file.txt',
                    mimeType: 'text/plain',
                    text: 'File contents'
                }
            };

            const result = safeParse(ContentBlockSchema, embeddedResource);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('resource');
            }
        });
    });

    describe('PromptMessage with ContentBlock', () => {
        test('should validate prompt message with resource link', () => {
            const promptMessage = {
                role: 'assistant',
                content: {
                    type: 'resource_link',
                    uri: 'file:///project/src/main.rs',
                    name: 'main.rs',
                    description: 'Primary application entry point',
                    mimeType: 'text/x-rust'
                }
            };

            const result = safeParse(PromptMessageSchema, promptMessage);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.content.type).toBe('resource_link');
            }
        });
    });

    describe('CallToolResult with ContentBlock', () => {
        test('should validate tool result with resource links', () => {
            const toolResult = {
                content: [
                    {
                        type: 'text',
                        text: 'Found the following files:'
                    },
                    {
                        type: 'resource_link',
                        uri: 'file:///project/src/main.rs',
                        name: 'main.rs',
                        description: 'Primary application entry point',
                        mimeType: 'text/x-rust'
                    },
                    {
                        type: 'resource_link',
                        uri: 'file:///project/src/lib.rs',
                        name: 'lib.rs',
                        description: 'Library exports',
                        mimeType: 'text/x-rust'
                    }
                ]
            };

            const result = safeParse(CallToolResultSchema, toolResult);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.content).toHaveLength(3);
                expect(result.data.content[0].type).toBe('text');
                expect(result.data.content[1].type).toBe('resource_link');
                expect(result.data.content[2].type).toBe('resource_link');
            }
        });

        test('should validate empty content array with default', () => {
            const toolResult = {};

            const result = safeParse(CallToolResultSchema, toolResult);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.content).toEqual([]);
            }
        });
    });

    describe('CompleteRequest', () => {
        test('should validate a CompleteRequest without resolved field', () => {
            const request = {
                method: 'completion/complete',
                params: {
                    ref: { type: 'ref/prompt', name: 'greeting' },
                    argument: { name: 'name', value: 'A' }
                }
            };

            const result = safeParse(CompleteRequestSchema, request);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.method).toBe('completion/complete');
                expect(result.data.params.ref.type).toBe('ref/prompt');
                expect(result.data.params.context).toBeUndefined();
            }
        });

        test('should validate a CompleteRequest with resolved field', () => {
            const request = {
                method: 'completion/complete',
                params: {
                    ref: { type: 'ref/resource', uri: 'github://repos/{owner}/{repo}' },
                    argument: { name: 'repo', value: 't' },
                    context: {
                        arguments: {
                            '{owner}': 'microsoft'
                        }
                    }
                }
            };

            const result = safeParse(CompleteRequestSchema, request);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.params.context?.arguments).toEqual({
                    '{owner}': 'microsoft'
                });
            }
        });

        test('should validate a CompleteRequest with empty resolved field', () => {
            const request = {
                method: 'completion/complete',
                params: {
                    ref: { type: 'ref/prompt', name: 'test' },
                    argument: { name: 'arg', value: '' },
                    context: {
                        arguments: {}
                    }
                }
            };

            const result = safeParse(CompleteRequestSchema, request);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.params.context?.arguments).toEqual({});
            }
        });

        test('should validate a CompleteRequest with multiple resolved variables', () => {
            const request = {
                method: 'completion/complete',
                params: {
                    ref: { type: 'ref/resource', uri: 'api://v1/{tenant}/{resource}/{id}' },
                    argument: { name: 'id', value: '123' },
                    context: {
                        arguments: {
                            '{tenant}': 'acme-corp',
                            '{resource}': 'users'
                        }
                    }
                }
            };

            const result = safeParse(CompleteRequestSchema, request);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.params.context?.arguments).toEqual({
                    '{tenant}': 'acme-corp',
                    '{resource}': 'users'
                });
            }
        });
    });
});
