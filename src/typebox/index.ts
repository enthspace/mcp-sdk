import { Compile, Validator } from 'typebox/compile';
import type { TSchema } from 'typebox';

import { schemas as mcpSchemas } from '@enth/mcp-specs/draft/schemas';
import type { JsonSchemaType, JsonSchemaValidator, JsonSchemaValidatorResult } from '@enth/mcp-specs';
import type { JsonSchemaValidatorProvider } from '../shared/protocol';

type ContextType = Record<string, TSchema>;
type ValidatorType<T> = Validator<ContextType, JsonSchemaType<T>>;

export class TypeboxJsonSchemaValidatorProvider implements JsonSchemaValidatorProvider {
    private _validators = new Map<string, ValidatorType<unknown>>();
    private _schemas: ContextType;

    constructor(schemas?: ContextType) {
        this._schemas = schemas ?? mcpSchemas;
    }

    private wrapValidator<T>(validator: ValidatorType<T>): JsonSchemaValidator<T> {
        return (input: unknown): JsonSchemaValidatorResult<T> => {
            const errors = validator.Errors(input);
            if (errors.length === 0) {
                return {
                    valid: true,
                    data: input as T,
                    errorMessage: undefined
                };
            } else {
                return {
                    valid: false,
                    data: undefined,
                    errorMessage: errors.map(err => `${err.instancePath} ${err.message}`).join(', ')
                };
            }
        };
    }

    getValidator<T>(schema: JsonSchemaType<T>): JsonSchemaValidator<T> {
        if ('$id' in schema && typeof schema.$id === 'string') {
            const existingValidator = this._validators.get(schema.$id) as Validator<ContextType, JsonSchemaType<T>> | undefined;
            if (!existingValidator) {
                const validator = Compile(this._schemas, schema);
                this._validators.set(schema.$id, validator as ValidatorType<unknown>);
                return this.wrapValidator<T>(validator);
            }
            return this.wrapValidator(existingValidator);
        }
        const validator = Compile(this._schemas, schema);
        return this.wrapValidator(validator);
    }
}
