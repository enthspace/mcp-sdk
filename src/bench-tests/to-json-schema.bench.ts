import { describe, bench } from 'vitest';

import { z } from 'zod';
import { ZodToJsonSchemaPlugin } from '../zod';
import * as v from 'valibot';
import { ValibotToJsonSchemaPlugin } from '../valibot';
import { Type } from "typebox";

const newZodTestSchema = () => z.object({
    uuidField: z.uuid(),
    base64Field: z.base64(),
    recordField: z.record(
        z.string(),
        z.object({
            urlField: z.url()
        })
    ),
    arrayField: z.array(
        z.object({
            numberField: z.number().min(0).max(100),
            emailField: z.email()
        })
    ),
    optionalField: z.optional(z.object({
            stringField: z.string().optional(),
    }))
});

const newValibotTestSchema = () => v.object({
    uuidField: v.pipe(v.string(), v.uuid()),
    base64Field: v.pipe(v.string(), v.base64()),
    recordField: v.record(
        v.string(),
        v.object({
            urlField: v.pipe(v.string(), v.url())
        })
    ),
    arrayField: v.array(
        v.object({
            numberField: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
            emailField: v.pipe(v.string(), v.email())
        })
    ),
    optionalField: v.optional(v.object({
        stringField: v.optional(v.string())
    }))
});

const newTypeboxTestSchema = () => Type.Object({
    uuidField: Type.String({ format: 'uuid' }),
    base64Field: Type.String({ contentEncoding: 'base64' }),
    recordField: Type.Record(
        Type.String(),
        Type.Object({
            urlField: Type.String({ format: 'uri' })
        })
    ),
    arrayField: Type.Array(
        Type.Object({
            numberField: Type.Number({ minimum: 0, maximum: 100 }),
            emailField: Type.String({ format: 'email' })
        })
    ),
    optionalField: Type.Optional(Type.Object({
        stringField: Type.Optional(Type.String())
    }))
});

describe('new schema', () => {
    bench('zod', () => {
        newZodTestSchema();
    });
    bench('valibot', () => {
        newValibotTestSchema();
    });
    bench('typebox', () => {
        newTypeboxTestSchema();
    });
});

describe('new schema plugin', () => {
    bench('zod', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const result = new ZodToJsonSchemaPlugin();
    });
    bench('valibot', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const result = new ValibotToJsonSchemaPlugin();
    });
    bench('typebox', () => {
        // No-op
    });
});

describe('new schema to JSON Schema', () => {
    bench('zod', () => {
        const testSchema = newZodTestSchema();
        const plugin = new ZodToJsonSchemaPlugin();
        plugin.toJsonSchema(testSchema);
    });
    bench('valibot', () => {
        const testSchema = newValibotTestSchema();
        const plugin = new ValibotToJsonSchemaPlugin();
        plugin.toJsonSchema(testSchema);
    });
    bench('typebox', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const testSchema = newTypeboxTestSchema();
    });
});

describe('to JSON Schema', () => {
    const zodTestSchema = newZodTestSchema();
    const zodPlugin = new ZodToJsonSchemaPlugin();
    bench('zod', () => {
        zodPlugin.toJsonSchema(zodTestSchema);
    });
    const valibotTestSchema = newValibotTestSchema();
    const valibotPlugin = new ValibotToJsonSchemaPlugin();
    bench('valibot', () => {
        valibotPlugin.toJsonSchema(valibotTestSchema);
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const typeboxTestSchema = newTypeboxTestSchema();
    bench('typebox', () => {
        // No-op
    });
});