const mcpSdk = require('./sdk');

const MCP_WORKFLOW =
    'Before any report call: run list_machines and collect machine `_id` values (MongoDB ObjectId strings). ' +
    'Dates must be YYYY-MM-DD. Shift: 0=day, 1=night; use [0,1] for all shifts.';

const TOOL_DEFINITIONS = [
    {
        name: 'list_machines',
        description:
            'List configured machines in the signed-in workspace. ' +
            'Always call this before report tools. Use each machine `_id` (string) in `machineIds` arrays.',
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
        description:
            'List distinct quality values seen in machine logs. ' +
            'Use a value from this list for get_quality_production_report.quality.',
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
        description:
            'Historical machine logs with full stopsData and stop reason mapping. ' +
            MCP_WORKFLOW +
            ' machineIds is optional (omit for all accessible machines).',
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
        description:
            'Shift-wise production report for selected machines and date range. ' +
            MCP_WORKFLOW +
            ' Required body: machineIds (non-empty), startDate, endDate, shift.',
        inputSchema: {
            machineIds: { type: 'array', items: { type: 'string' } },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            shift: { description: 'Shift number or array' },
        },
    },
    {
        name: 'get_quality_production_report',
        description:
            'Production report filtered by quality (not by machine list). ' +
            MCP_WORKFLOW +
            ' Required body: quality (from list_machine_log_qualities), startDate, endDate, shift.',
        inputSchema: {
            quality: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            shift: { description: 'Shift number or array' },
        },
    },
    {
        name: 'get_stoppage_report',
        description:
            'Stoppage events above a minimum duration. ' +
            MCP_WORKFLOW +
            ' Required body: machineIds (non-empty), startDate, endDate, shift, minStopMinutes (positive number; web default is 5).',
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

const DATE_DESC = 'Inclusive calendar date as YYYY-MM-DD (e.g. 2026-09-22).';
const MACHINE_IDS_DESC =
    'Required. Non-empty array of machine MongoDB ObjectId strings from list_machines (`_id` field).';
const SHIFT_DESC =
    'Required. 0=day shift, 1=night shift. Use [0, 1] for all shifts (matches web app "All Shift").';

function buildInputSchema(toolName, z) {
    switch (toolName) {
        case 'get_machine_group':
            return {
                groupId: z.string().describe('Required. Machine group MongoDB ObjectId.'),
            };
        case 'get_machine_logs_details':
            return {
                startDate: z.string().describe(DATE_DESC),
                endDate: z.string().describe(DATE_DESC),
                machineIds: z.array(z.string()).optional().describe(
                    'Optional. Machine `_id` values from list_machines; omit to query all machines the user can access.'
                ),
                shift: z.union([z.number(), z.array(z.number())]).optional().describe(SHIFT_DESC),
                quality: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by quality name(s).'),
                operatorId: z.string().optional().describe('Operator MongoDB ObjectId from list_operators.'),
                machineGroupId: z.string().optional().describe('Machine group ObjectId from list_machine_groups.'),
                page: z.number().optional().describe('Page number (default 1).'),
                limit: z.number().optional().describe('Page size (default 50, max 100).'),
            };
        case 'get_production_report':
            return {
                machineIds: z.array(z.string()).min(1).describe(MACHINE_IDS_DESC),
                startDate: z.string().describe(DATE_DESC),
                endDate: z.string().describe(DATE_DESC),
                shift: z
                    .union([z.number(), z.array(z.number()).min(1)])
                    .describe(SHIFT_DESC),
            };
        case 'get_quality_production_report':
            return {
                quality: z
                    .string()
                    .min(1)
                    .describe('Required. Quality name from list_machine_log_qualities.'),
                startDate: z.string().describe(DATE_DESC),
                endDate: z.string().describe(DATE_DESC),
                shift: z
                    .union([z.number(), z.array(z.number()).min(1)])
                    .describe(SHIFT_DESC),
            };
        case 'get_stoppage_report':
            return {
                machineIds: z.array(z.string()).min(1).describe(MACHINE_IDS_DESC),
                startDate: z.string().describe(DATE_DESC),
                endDate: z.string().describe(DATE_DESC),
                shift: z
                    .union([z.number(), z.array(z.number()).min(1)])
                    .describe(SHIFT_DESC),
                minStopMinutes: z
                    .number()
                    .positive()
                    .describe(
                        'Required. Minimum stop duration in minutes (must be > 0). Common values: 5, 10, 15, 30, 45.'
                    ),
            };
        default:
            return null;
    }
}

function buildDefaultSchema(tool, z) {
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
    return schema;
}

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
            instructions:
                'TrackWeaving read-only MCP. For production, quality production, or stoppage reports you MUST ' +
                'call list_machines first, pass non-empty machineIds (except quality report), YYYY-MM-DD startDate/endDate, ' +
                'shift (0 day, 1 night, or [0,1] for all), and for stoppage reports minStopMinutes (> 0). ' +
                'Quality reports require quality from list_machine_log_qualities instead of machineIds.',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    for (const tool of TOOL_DEFINITIONS) {
        const schema = buildInputSchema(tool.name, z) ?? buildDefaultSchema(tool, z);

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
