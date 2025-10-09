const machineService = require("../../services/machineService");
const maintenanceCategoryService = require("../../services/maintenanceCategoryService");
const maintenanceDataService = require("../../services/maintenanceDataService");
const { log, checkRequiredParams } = require("../../services/utilService");
const moment = require("moment");

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
            let maintenanceData = await maintenanceDataService.find({ machineId: { $in: machineIds }, maintenanceCategoryId: { $in: maintenanceCategoryIds }}, { projection: "maintenanceCategoryId machineId nextMaintenanceDate", useLean: true });

            let alerts = {};
            for(let data of maintenanceData) {
                let machineId = data.machineId.toString();
                if (!alerts[machineId]) {
                    alerts[machineId] = {
                        machineId: machineId,
                        machineCode: machines.find(m => m._id.toString() === machineId)?.machineCode || '',
                        machineName: machines.find(m => m._id.toString() === machineId)?.machineName || '',
                        alerts: []
                    };
                }
                let isDue = moment().isSameOrAfter(moment(moment(new Date(data.nextMaintenanceDate).toISOString()).startOf('day').subtract(categoriesMap[data.maintenanceCategoryId]?.alertDays || 0, 'days')));
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
            await checkRequiredParams(['completedBy', 'nextMaintenanceDate', 'lastMaintenanceDate','remarks'], req.body);
            let maintenanceData = await maintenanceDataService.findOne({ _id: req.params.id, isDeleted: false });
            if (!maintenanceData) {
                return res.badRequest({}, "No maintenance data found for this machine and category.");
            }
            let historyEntry = {
                lastMaintenanceDate: maintenanceData.lastMaintenanceDate,
                nextMaintenanceDate: maintenanceData.nextMaintenanceDate,
                remarks: maintenanceData.remarks,
                updatedAt: maintenanceData.updatedAt,
                completedBy: maintenanceData.completedBy,
                completedByMobile: maintenanceData.completedByMobile
            };
            let updatedData = {
                lastMaintenanceDate: new Date(req.body.lastMaintenanceDate),
                nextMaintenanceDate: new Date(req.body.nextMaintenanceDate),
                remarks: req.body.remarks,
                completedBy: req.body.completedBy,
                $push: { history: historyEntry }
            };
            if(req.body.completedByMobile) {
                updatedData.completedByMobile = req.body.completedByMobile;
            }
            let updatedMaintenanceData = await maintenanceDataService.findByIdAndUpdate(maintenanceData._id, updatedData);

            return res.ok(updatedMaintenanceData, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}