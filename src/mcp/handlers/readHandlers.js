const machineService = require('../../api/services/machineService');
const machineGroupService = require('../../api/services/machineGroupService');
const operatorService = require('../../api/services/operatorService');
const machineLogsService = require('../../api/services/machineLogsService');
const reportService = require('../../api/services/reportService');
const userService = require('../../api/services/userService');
const accessService = require('../../api/services/accessService');
const alertConfigService = require('../../api/services/alertConfigService');
const maintenanceCategoryService = require('../../api/services/maintenanceCategoryService');
const partChangeLogService = require('../../api/services/partChangeLogService');
const utilService = require('../../api/services/utilService');
const { buildUserFromAuth, assertReadAccess } = require('../userContext');

const { MODULE_KEYS } = accessService;

function jsonResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
}

function withUser(authInfo, handler) {
    return async (args) => {
        const user = buildUserFromAuth(authInfo);
        return handler(user, args || {});
    };
}

const MCP_PARAM_HINT =
    'Call list_machines and pass `_id` values in machineIds. Dates: YYYY-MM-DD. Shift: 0 (day), 1 (night), or [0,1] (all).';

function assertMcpReportBody(args, { requireMachineIds = false, requireMinStopMinutes = false, requireQuality = false } = {}) {
    const missing = [];
    if (!args.startDate) missing.push('startDate');
    if (!args.endDate) missing.push('endDate');
    if (args.shift === undefined || args.shift === null || (Array.isArray(args.shift) && args.shift.length === 0)) {
        missing.push('shift');
    }
    if (requireMachineIds && (!Array.isArray(args.machineIds) || args.machineIds.length === 0)) {
        missing.push('machineIds');
    }
    if (requireQuality && !String(args.quality || '').trim()) {
        missing.push('quality');
    }
    if (requireMinStopMinutes && (!args.minStopMinutes || args.minStopMinutes <= 0)) {
        missing.push('minStopMinutes');
    }
    if (missing.length) {
        throw new Error(`Missing or invalid required fields: ${missing.join(', ')}. ${MCP_PARAM_HINT}`);
    }
}

module.exports = {
    createReadHandlers(authInfo) {
        return {
            list_machines: withUser(authInfo, async (user) => {
                assertReadAccess(user, MODULE_KEYS.MACHINE_CONFIGURE);
                const machines = await machineService.find(
                    { workspaceId: user.workspaceId, isDeleted: false },
                    { useLean: true }
                );
                return jsonResult(machines);
            }),

            list_machine_groups: withUser(authInfo, async (user) => {
                const groups = await machineGroupService.find(
                    { workspaceId: user.workspaceId, isDeleted: false },
                    { useLean: true, sort: { groupName: 1 } }
                );
                return jsonResult(groups);
            }),

            get_machine_group: withUser(authInfo, async (user, { groupId }) => {
                assertReadAccess(user, MODULE_KEYS.MACHINE_GROUP);
                if (!utilService.isValidObjectId(groupId)) {
                    throw global.config.message.BAD_REQUEST;
                }
                const group = await machineGroupService.findOne(
                    { _id: groupId, workspaceId: user.workspaceId, isDeleted: false },
                    { useLean: true }
                );
                return jsonResult(group);
            }),

            list_operators: withUser(authInfo, async (user, { page = 1, limit = 50 }) => {
                assertReadAccess(user, MODULE_KEYS.OPERATOR);
                const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
                const operators = await operatorService.find(
                    { workspaceId: user.workspaceId },
                    { skip, limit: Math.min(limit, 100), sort: { operatorName: 1 }, useLean: true }
                );
                return jsonResult({ page, limit, operators });
            }),

            list_machine_log_qualities: withUser(authInfo, async (user) => {
                const filter = { workspaceId: user.workspaceId };
                if (user.isMaster && user.machineIds?.length) {
                    filter.machineId = { $in: user.machineIds };
                }
                const qualities = await machineLogsService.getDistinctQualities(filter);
                return jsonResult(qualities);
            }),

            list_live_machine_logs: withUser(authInfo, async (user, args) => {
                const body = {
                    workspaceId: user.workspaceId,
                    page: args.page || 1,
                    limit: args.limit || 100,
                    status: args.status || 'all',
                };
                if (user.isMaster) {
                    body.masterMachineIds = user.machineIds;
                }
                const machineLogsData = await machineLogsService.getMachineLogsWithPagination(body);
                return jsonResult(machineLogsData);
            }),

            get_machine_logs_details: withUser(authInfo, async (user, args) => {
                utilService.checkRequiredParams(['startDate', 'endDate'], args);
                const result = await machineLogsService.getMachineLogsFullDetails({
                    workspaceId: user.workspaceId,
                    masterMachineIds: user.isMaster ? user.machineIds : undefined,
                    machineIds: args.machineIds,
                    startDate: args.startDate,
                    endDate: args.endDate,
                    shift: args.shift,
                    quality: args.quality,
                    operatorId: args.operatorId,
                    machineGroupId: args.machineGroupId,
                    page: args.page || 1,
                    limit: args.limit || 50,
                });
                return jsonResult(result);
            }),

            get_production_report: withUser(authInfo, async (user, args) => {
                assertReadAccess(user, MODULE_KEYS.REPORT);
                assertMcpReportBody(args, { requireMachineIds: true });
                const data = await reportService.generateProductionShiftWiseReport({
                    workspaceId: user.workspaceId,
                    machineIds: args.machineIds,
                    startDate: args.startDate,
                    endDate: args.endDate,
                    shift: args.shift,
                });
                return jsonResult(data);
            }),

            get_quality_production_report: withUser(authInfo, async (user, args) => {
                assertReadAccess(user, MODULE_KEYS.REPORT);
                assertMcpReportBody(args, { requireQuality: true });
                const data = await reportService.generateQualityProductionReport({
                    workspaceId: user.workspaceId,
                    quality: args.quality,
                    startDate: args.startDate,
                    endDate: args.endDate,
                    shift: args.shift,
                });
                return jsonResult(data);
            }),

            get_stoppage_report: withUser(authInfo, async (user, args) => {
                assertReadAccess(user, MODULE_KEYS.REPORT);
                assertMcpReportBody(args, { requireMachineIds: true, requireMinStopMinutes: true });
                const data = await reportService.generateStoppageReport({
                    workspaceId: user.workspaceId,
                    machineIds: args.machineIds,
                    startDate: args.startDate,
                    endDate: args.endDate,
                    shift: args.shift,
                    minStopMinutes: args.minStopMinutes,
                });
                return jsonResult(data);
            }),

            list_users: withUser(authInfo, async (user) => {
                assertReadAccess(user, MODULE_KEYS.USER);
                const users = await userService.findV2(
                    { workspaceId: user.workspaceId },
                    { sort: { userName: 1 }, useLean: true }
                );
                return jsonResult(users);
            }),

            get_access_matrix: withUser(authInfo, async (user) => {
                if (!user.isOwner) {
                    throw global.config.message.OPERATION_NOT_PERMITTED;
                }
                return jsonResult({ moduleWiseAccess: accessService.MODULE_WISE_ACCESS });
            }),

            list_maintenance_categories: withUser(authInfo, async (user) => {
                assertReadAccess(user, MODULE_KEYS.MAINTENANCE_CATEGORY);
                const rows = await maintenanceCategoryService.find(
                    { workspaceId: user.workspaceId, isDeleted: false },
                    { useLean: true, sort: { name: 1 } }
                );
                return jsonResult(rows);
            }),

            list_part_change_logs: withUser(authInfo, async (user, args) => {
                assertReadAccess(user, MODULE_KEYS.PART_CHANGE_ENTRY);
                const rows = await partChangeLogService.find(
                    { workspaceId: user.workspaceId },
                    {
                        skip: ((args.page || 1) - 1) * (args.limit || 50),
                        limit: Math.min(args.limit || 50, 100),
                        sort: { createdAt: -1 },
                        useLean: true,
                    }
                );
                return jsonResult(rows);
            }),

            get_alert_config: withUser(authInfo, async (user) => {
                if (!user.isOwner) {
                    throw global.config.message.ACCESS_DENIED;
                }
                const config = await alertConfigService.findOne(
                    { workspaceId: user.workspaceId },
                    { useLean: true }
                );
                return jsonResult(config);
            }),
        };
    },
};
