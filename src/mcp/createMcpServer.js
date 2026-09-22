const mcpSdk = require('./sdk');

const TOOL_DEFINITIONS = [
    {
        name: 'list_machines',
        description: 'List configured machines in the signed-in workspace.',
        inputSchema: {},
    },
    {
        name: 'list_machine_groups',
        description: 'List machine groups in the workspace.',
        inputSchema: {},
    },
    {
        name: 'get_machine_group',
        description: 'Get one machine group by id.',
        inputSchema: { groupId: { type: 'string', description: 'Machine group ObjectId' } },
    },
    {
        name: 'list_operators',
        description: 'List operators with pagination.',
        inputSchema: {
            page: { type: 'number', description: 'Page number (default 1)' },
            limit: { type: 'number', description: 'Page size (max 100)' },
        },
    },
    {
        name: 'list_machine_log_qualities',
        description: 'List distinct quality values seen in machine logs.',
        inputSchema: {},
    },
    {
        name: 'list_live_machine_logs',
        description: 'Latest/live machine log snapshot per machine (dashboard view).',
        inputSchema: {
            page: { type: 'number' },
            limit: { type: 'number' },
            status: { type: 'string', description: 'all | running | stopped' },
        },
    },
    {
        name: 'get_machine_logs_details',
        description: 'Historical machine logs with full stopsData and stop reason mapping (statusCode → getStopReason).',
        inputSchema: {
            startDate: { type: 'string', description: 'ISO date or YYYY-MM-DD (required)' },
            endDate: { type: 'string', description: 'ISO date or YYYY-MM-DD (required)' },
            machineIds: { type: 'array', items: { type: 'string' }, description: 'Optional machine ids; omit for all accessible machines' },
            shift: { description: 'Shift filter: 0=day, 1=night, or array of shifts' },
            quality: { description: 'Quality string or array of qualities' },
            operatorId: { type: 'string', description: 'Operator ObjectId' },
            machineGroupId: { type: 'string', description: 'Machine group ObjectId' },
            page: { type: 'number' },
            limit: { type: 'number' },
        },
    },
    {
        name: 'get_production_report',
        description: 'Shift-wise production report for selected machines and date range.',
        inputSchema: {
            machineIds: { type: 'array', items: { type: 'string' } },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            shift: { description: 'Shift number or array' },
        },
    },
    {
        name: 'get_quality_production_report',
        description: 'Production report filtered by quality.',
        inputSchema: {
            quality: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            shift: { description: 'Shift number or array' },
        },
    },
    {
        name: 'get_stoppage_report',
        description: 'Stoppage events above a minimum duration.',
        inputSchema: {
            machineIds: { type: 'array', items: { type: 'string' } },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            shift: { description: 'Shift number or array' },
            minStopMinutes: { type: 'number' },
        },
    },
    {
        name: 'list_users',
        description: 'List workspace users (requires user read permission).',
        inputSchema: {},
    },
    {
        name: 'get_access_matrix',
        description: 'Return module/action access matrix definition.',
        inputSchema: {},
    },
    {
        name: 'list_maintenance_categories',
        description: 'List maintenance categories.',
        inputSchema: {},
    },
    {
        name: 'list_part_change_logs',
        description: 'List part change logs.',
        inputSchema: {
            page: { type: 'number' },
            limit: { type: 'number' },
        },
    },
    {
        name: 'get_alert_config',
        description: 'Get workspace alert configuration (owner only).',
        inputSchema: {},
    },
];

function createMcpServer(authInfo) {
    const { McpServer } = mcpSdk.getMcpServer();
    const z = mcpSdk.getZod();
    const { createReadHandlers } = require('./handlers/readHandlers');
    const handlers = createReadHandlers(authInfo);

    const server = new McpServer(
        {
            name: 'trackweaving-mcp',
            version: '1.0.0',
            websiteUrl: 'https://trackweaving.com',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    for (const tool of TOOL_DEFINITIONS) {
        const schema = {};
        for (const [key, meta] of Object.entries(tool.inputSchema || {})) {
            if (meta.type === 'array') {
                schema[key] = z.array(z.string()).optional().describe(meta.description || key);
            } else if (meta.type === 'number') {
                schema[key] = z.number().optional().describe(meta.description || key);
            } else {
                schema[key] = z.string().optional().describe(meta.description || key);
            }
        }
        if (tool.name === 'get_machine_logs_details') {
            schema.startDate = z.string().describe('Start date (required)');
            schema.endDate = z.string().describe('End date (required)');
            schema.shift = z.union([z.number(), z.array(z.number())]).optional();
            schema.quality = z.union([z.string(), z.array(z.string())]).optional();
        }

        server.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema: schema,
                annotations: {
                    readOnlyHint: true,
                    openWorldHint: false,
                },
            },
            async (args) => {
                try {
                    return await handlers[tool.name](args);
                } catch (error) {
                    const message = error?.message || String(error);
                    return {
                        content: [{ type: 'text', text: `Error: ${message}` }],
                        isError: true,
                    };
                }
            }
        );
    }

    return server;
}

module.exports = {
    createMcpServer,
    TOOL_DEFINITIONS,
};
