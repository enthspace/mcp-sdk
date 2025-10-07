import type { SizeLimitConfig } from 'size-limit';

export default [
    {
        name: 'Client',
        import: '{ Client }',
        limit: '11.53 kB', // Started at 44 kB
        path: ['dist/esm/client/index.js']
    },
    {
        name: 'Server',
        import: '{ Server }',
        limit: '9.00 kB', // Started at 43.87 kB 
        path: ['dist/esm/server/index.js']
    },
    {
        name: 'McpServer',
        import: '{ McpServer }',
        limit: '12.62 kB', // started at 50.17 kB
        path: ['dist/esm/server/mcp.js']
    }
] satisfies SizeLimitConfig;
