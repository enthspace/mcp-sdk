import { ZodType } from 'zod';

export enum McpZodTypeKind {
    Completable = 'McpCompletable'
}

export type CompleteCallback<T extends ZodType = ZodType> = (
    value: T['_input'],
    context?: {
        arguments?: Record<string, string>;
    }
) => T['_input'][] | Promise<T['_input'][]>;

export interface CompletableDef<T extends ZodType = ZodType> {
    type: T;
    complete: CompleteCallback<T>;
    typeName: McpZodTypeKind.Completable;
}

/**
 * Wraps a Zod type to provide autocompletion capabilities. Useful for, e.g., prompt arguments in MCP.
 */
export function completable<T extends ZodType>(
    schema: T,
    complete: CompleteCallback<T>
): T & {
    _def: (T extends { _def: infer D } ? D : unknown) & CompletableDef<T>;
} {
    const target = schema as unknown as { _def?: Record<string, unknown> };
    const originalDef = (target._def ?? {}) as Record<string, unknown>;
    // Only mutate the existing _def object to respect read-only property semantics
    if ((originalDef as { typeName?: unknown }).typeName !== McpZodTypeKind.Completable) {
        (originalDef as { typeName?: McpZodTypeKind; type?: ZodType }).typeName = McpZodTypeKind.Completable;
        (originalDef as { typeName?: McpZodTypeKind; type?: ZodType }).type = schema;
    }
    (originalDef as { complete?: CompleteCallback<T> }).complete = complete;
    return schema as unknown as T & {
        _def: (T extends { _def: infer D } ? D : unknown) & CompletableDef<T>;
    };
}
