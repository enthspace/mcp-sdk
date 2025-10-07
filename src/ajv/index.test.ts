import { AjvJsonSchemaValidatorProvider } from './index.js';
import { describe, it, expect } from 'vitest';

import { ToolSchema } from '@enth/mcp-specs/draft';
import type { Tool } from '@enth/mcp-specs/draft';
import type { JsonSchemaType } from '@enth/mcp-specs';

describe('AjvJsonSchemaValidatorProvider', () => {
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
        const provider = new AjvJsonSchemaValidatorProvider();
        const validator = provider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);

        const result = validator(validTool);
        expect(result.valid).toBe(true);
        expect(result.data).toEqual(validTool);
    });
});
