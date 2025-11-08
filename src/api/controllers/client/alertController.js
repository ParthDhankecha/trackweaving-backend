const moment = require('moment');

const machineService = require('../../services/machineService');
const maintenanceCategoryService = require('../../services/maintenanceCategoryService');
const maintenanceDataService = require('../../services/maintenanceDataService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    getAlertList: async (req, res, next) => {
        try {
            let machines = await machineService.find({ workspaceId: req.user.workspaceId, isAlertActive: true }, { projection: "machineCode machineName" });
            let machineIds = machines.map(machine => machine._id);
            let maintenanceCategories = await maintenanceCategoryService.find({ workspaceId: req.user.workspaceId, isActive: true }, { projection: "name alertDays scheduleDays" });
            let categoriesMap = {};
            let maintenanceCategoryIds = maintenanceCategories.map(category => {
                categoriesMap[category._id] = category;
                return category._id;
            });
            let maintenanceData = await maintenanceDataService.find({ machineId: { $in: machineIds }, maintenanceCategoryId: { $in: maintenanceCategoryIds } }, { projection: "maintenanceCategoryId machineId nextMaintenanceDate", useLean: true });

            const alerts = {};
            for (let data of maintenanceData) {
                let machineId = data.machineId.toString();
                if (!alerts[machineId]) {
                    alerts[machineId] = {
                        machineId: machineId,
                        machineCode: machines.find(m => m._id.toString() === machineId)?.machineCode || '',
                        machineName: machines.find(m => m._id.toString() === machineId)?.machineName || '',
                        alerts: []
                    };
                }
                const isDue = moment().isSameOrAfter(moment(moment(new Date(data.nextMaintenanceDate).toISOString()).startOf('day').subtract(categoriesMap[data.maintenanceCategoryId]?.alertDays || 0, 'days')));
                alerts[machineId].alerts.push({ ...data, isDue, scheduleDays: categoriesMap[data.maintenanceCategoryId]?.scheduleDays || 0, categoryName: categoriesMap[data.maintenanceCategoryId]?.name || '' });
            }

            return res.ok(Object.values(alerts), global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateAlert: async (req, res, next) => {
        try {
            const body = req.body;
            checkRequiredParams(['completedBy', 'nextMaintenanceDate', 'lastMaintenanceDate'], body);

            const maintenanceData = await maintenanceDataService.findOne({ _id: req.params.id, isDeleted: false }, { useLean: true });
            if (!maintenanceData) {
                return res.badRequest({}, "No maintenance data found for this machine and category.");
            }

            const historyEntry = {
                lastMaintenanceDate: maintenanceData.lastMaintenanceDate,
                nextMaintenanceDate: maintenanceData.nextMaintenanceDate,
                remarks: maintenanceData.remarks || '',
                updatedAt: maintenanceData.updatedAt,
                completedBy: maintenanceData.completedBy,
                completedByMobile: maintenanceData.completedByMobile
            };
            const updatedData = {
                lastMaintenanceDate: new Date(body.lastMaintenanceDate),
                nextMaintenanceDate: new Date(body.nextMaintenanceDate),
                remarks: body.remarks,
                completedBy: body.completedBy,
                $push: { history: historyEntry }
            };
            if (body.completedByMobile) {
                updatedData.completedByMobile = body.completedByMobile;
            }

            const updatedMaintenanceData = await maintenanceDataService.findByIdAndUpdate(maintenanceData._id, updatedData);

            return res.ok(updatedMaintenanceData, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}