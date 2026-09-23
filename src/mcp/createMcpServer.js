const mcpSdk = require('./sdk');

const MCP_DATES =
    'Dates: YYYY-MM-DD inclusive. Shift: 0=day, 1=night, [0,1]=all shifts.';

const MCP_TOOL_ROUTING =
    'Call the minimum tools needed—never fetch the same date range via both log details and a report tool. ' +
    'Pick exactly ONE data tool per user question unless the user explicitly asks for two different views. ' +
    'Routing: (1) Current/live machine status now → list_live_machine_logs only. ' +
    '(2) Official shiftwise production totals matching the web Production report (efficiency, meters, shift/day aggregates) → get_production_report only; call list_machines first for machineIds. ' +
    '(3) Production by quality name (not by machine pick list) → list_machine_log_qualities then get_quality_production_report only. ' +
    '(4) Stoppage list filtered by minimum minutes (web Stoppage report) → get_stoppage_report only; call list_machines first. ' +
    '(5) Per-shift raw logs, individual stop events/times/reasons, operator/group filters, or drill-down on one machine → get_machine_logs_details only (paginate with page/limit until totalPages exhausted). ' +
    'Do NOT call get_machine_logs_details together with get_production_report or get_stoppage_report for the same question—they overlap; reports are pre-aggregated, log details are raw rows. ' +
    'Call list_machines only when you need machine `_id` values for report tools or to map codes to ids—not before list_live_machine_logs.';

const TOOL_DEFINITIONS = [
    {
        name: 'list_machines',
        description:
            'List configured machines in the signed-in workspace. ' +
            'Call only when you need machine `_id` for get_production_report or get_stoppage_report, or to resolve machineCode/name to id. ' +
            'Skip if using get_machine_logs_details with no machineIds (all machines) or list_live_machine_logs.',
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
        description:
            'Latest/live machine log snapshot per machine (dashboard “now”). ' +
            'Use for current running/stopped status—not for historical dates. Do not use with report or get_machine_logs_details for the same query.',
        inputSchema: {
            page: { type: 'number' },
            limit: { type: 'number' },
            status: { type: 'string', description: 'all | running | stopped' },
        },
    },
    {
        name: 'get_machine_logs_details',
        description:
            'Historical raw shift logs (paginated) with stopsData and stop reasons. ' +
            MCP_DATES +
            ' Use for drill-down, per-stop timelines, operator/group/quality filters—not for official report totals. ' +
            'Do NOT also call get_production_report or get_stoppage_report for the same question. machineIds optional.',
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
            'Official Production Shiftwise report (web parity): grouped totals/averages per date and shift. ' +
            MCP_DATES +
            ' Use when the user wants production/efficiency/meters summary—not raw logs. ' +
            'Requires list_machines → machineIds, startDate, endDate, shift. Do NOT also call get_machine_logs_details.',
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
            'Official quality-based production report (web parity). ' +
            MCP_DATES +
            ' Use when filtering by quality name, not by selected machines. ' +
            'Call list_machine_log_qualities for quality, then this tool only—do not use get_production_report or get_machine_logs_details for the same question.',
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
            'Official Stoppage report (web parity): flat list of stops ≥ minStopMinutes. ' +
            MCP_DATES +
            ' Use for “stoppage report” style answers—not raw log pagination. ' +
            'Requires list_machines → machineIds, startDate, endDate, shift, minStopMinutes (default 5). Do NOT also call get_machine_logs_details.',
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
                limit: z.number().optional().describe('Page size (default 50, max 200). Paginate until totalPages is reached.'),
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
            instructions: 'TrackWeaving read-only MCP. ' + MCP_TOOL_ROUTING,
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
