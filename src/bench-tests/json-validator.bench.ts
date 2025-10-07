import { describe, bench } from 'vitest';

import { AjvJsonSchemaValidatorProvider } from '../ajv';
import { CfWorkerJsonSchemaValidatorProvider } from '../cfworker';
import { TypeboxJsonSchemaValidatorProvider } from '../typebox';

import type { Tool } from '@enth/mcp-specs/draft';
import { ToolSchema } from '@enth/mcp-specs/draft';
import type { JsonSchemaType } from '@enth/mcp-specs';

const validTool: Tool = {
    name: 'My Tool',
    description: 'A tool that does something',
    inputSchema: {
        type: 'object',
        properties: {
            foo: { type: 'string' },
            bar: { type: 'number' }
        },
        required: ['foo']
    },
    outputSchema: {
        type: 'object',
        properties: {
            result: { type: 'string' }
        },
        required: ['result']
    },
    icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'], theme: 'light' }],
    annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
        title: 'My Tool'
    },
    title: 'My Tool'
};

describe('create provider', () => {
    bench('ajv', () => {
        new AjvJsonSchemaValidatorProvider();
    });
    bench('cfworker', () => {
        new CfWorkerJsonSchemaValidatorProvider();
    });
    bench('typebox', () => {
        new TypeboxJsonSchemaValidatorProvider();
    });
});

describe('create validator', () => {
    const ajvProvider = new AjvJsonSchemaValidatorProvider();
    bench('ajv', () => {
        ajvProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    });
    const cfworkerProvider = new CfWorkerJsonSchemaValidatorProvider();
    bench('cfworker', () => {
        cfworkerProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    });
    const typeboxProvider = new TypeboxJsonSchemaValidatorProvider();
    bench('typebox', () => {
        typeboxProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    });
});

describe('validate valid data', () => {
    const ajvProvider = new AjvJsonSchemaValidatorProvider();
    const ajvValidator = ajvProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    bench('ajv', () => {
        ajvValidator(validTool);
    });
    const cfworkerProvider = new CfWorkerJsonSchemaValidatorProvider();
    const cfworkerValidator = cfworkerProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    bench('cfworker', () => {
        cfworkerValidator(validTool);
    });
    const typeboxProvider = new TypeboxJsonSchemaValidatorProvider();
    const typeboxValidator = typeboxProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    bench('typebox', () => {
        typeboxValidator(validTool);
    });
});

describe('validate invalid data', () => {
    const invalidTool = {
        ...validTool,
        icons: validTool.icons?.[0], // Making invalid: should be an array
    };
    const ajvProvider = new AjvJsonSchemaValidatorProvider();
    const ajvValidator = ajvProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    bench('ajv', () => {
        ajvValidator(invalidTool);
    });
    const cfworkerProvider = new CfWorkerJsonSchemaValidatorProvider();
    const cfworkerValidator = cfworkerProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    bench('cfworker', () => {
        cfworkerValidator(invalidTool);
    });
    const typeboxProvider = new TypeboxJsonSchemaValidatorProvider();
    const typeboxValidator = typeboxProvider.getValidator(ToolSchema as unknown as JsonSchemaType<Tool>);
    bench('typebox', () => {
        typeboxValidator(invalidTool);
    });
});