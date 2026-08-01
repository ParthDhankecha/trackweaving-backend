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
            checkRequiredParams(['nextMaintenanceDate', 'lastMaintenanceDate'], body);

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
                completedBy: body.completedBy || '',
                $push: { history: historyEntry }
            };
            if (body.completedByMobile || body.phone) {
                updatedData.completedByMobile = body.completedByMobile || body.phone;
            }

            const updatedMaintenanceData = await maintenanceDataService.findByIdAndUpdate(maintenanceData._id, updatedData);

            return res.ok(updatedMaintenanceData, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    getMaintenanceHistory: async (req, res, next) => {
        try {
            const { maintenanceCategoryId, machineId } = req.query;
            if (!maintenanceCategoryId) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspaceId = req.user.workspaceId;
            const category = await maintenanceCategoryService.findOne({ _id: maintenanceCategoryId, workspaceId });
            if (!category) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const filter = {
                workspaceId,
                maintenanceCategoryId,
                isDeleted: false
            };
            if (machineId) {
                filter.machineId = machineId;
            }

            const machines = await machineService.find(
                { workspaceId, isDeleted: false },
                { projection: 'machineCode machineName', useLean: true }
            );
            const machineMap = {};
            machines.forEach(machine => {
                machineMap[machine._id.toString()] = machine;
            });

            const records = await maintenanceDataService.find(filter, { useLean: true });
            const list = [];

            for (const record of records) {
                const machine = machineMap[record.machineId?.toString()] || {};

                (record.history || []).forEach(entry => {
                    list.push({
                        machineId: record.machineId,
                        machineCode: machine.machineCode || '',
                        machineName: machine.machineName || '',
                        categoryName: category.name,
                        lastMaintenanceDate: entry.lastMaintenanceDate,
                        nextMaintenanceDate: entry.nextMaintenanceDate,
                        completedBy: entry.completedBy || '',
                        completedByMobile: entry.completedByMobile || '',
                        remarks: entry.remarks || '',
                        updatedAt: entry.updatedAt || null,
                        isCurrent: false
                    });
                });

                if (record.lastMaintenanceDate) {
                    list.push({
                        machineId: record.machineId,
                        machineCode: machine.machineCode || '',
                        machineName: machine.machineName || '',
                        categoryName: category.name,
                        lastMaintenanceDate: record.lastMaintenanceDate,
                        nextMaintenanceDate: record.nextMaintenanceDate,
                        completedBy: record.completedBy || '',
                        completedByMobile: record.completedByMobile || '',
                        remarks: record.remarks || '',
                        updatedAt: record.updatedAt || null,
                        isCurrent: true
                    });
                }
            }

            list.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.lastMaintenanceDate || 0).getTime();
                const dateB = new Date(b.updatedAt || b.lastMaintenanceDate || 0).getTime();
                return dateB - dateA;
            });

            return res.ok({
                list,
                categoryName: category.name,
                maintenanceCategoryId: category._id
            }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}