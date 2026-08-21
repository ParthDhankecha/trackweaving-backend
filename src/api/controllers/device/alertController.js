const moment = require("moment");

const machineService = require("../../services/machineService");
const maintenanceCategoryService = require("../../services/maintenanceCategoryService");
const maintenanceDataService = require("../../services/maintenanceDataService");
const utilService = require("../../services/utilService");


module.exports = {
    getAlertList: async (req, res, next) => {
        try {
            let machines = await machineService.find({ workspaceId: req.user.workspaceId, isAlertActive: true }, {
                projection: "machineCode machineName",
                useLean: true
            });
            let machineIds = machines.map(machine => machine._id);
            let maintenanceCategories = await maintenanceCategoryService.find({ workspaceId: req.user.workspaceId, isActive: true }, {
                projection: "name alertDays scheduleDays",
                useLean: true
            });
            let categoriesMap = {};
            let maintenanceCategoryIds = maintenanceCategories.map(category => {
                categoriesMap[category._id] = category;
                return category._id;
            });
            let maintenanceData = await maintenanceDataService.find({ machineId: { $in: machineIds }, maintenanceCategoryId: { $in: maintenanceCategoryIds } }, {
                projection: "maintenanceCategoryId machineId nextMaintenanceDate",
                useLean: true
            });

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
                let isDue = moment().isSameOrAfter(moment(moment(new Date(data.nextMaintenanceDate).toISOString()).startOf('day').subtract(categoriesMap[data.maintenanceCategoryId]?.alertDays || 0, 'days')));
                alerts[machineId].alerts.push({ ...data, isDue, scheduleDays: categoriesMap[data.maintenanceCategoryId]?.scheduleDays || 0, categoryName: categoriesMap[data.maintenanceCategoryId]?.name || '' });
            }

            return res.ok(Object.values(alerts), global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMaintenanceHistory: async (req, res, next) => {
        try {
            const { maintenanceCategoryId, machineId } = req.body;
            if (!utilService.isValidObjectId(maintenanceCategoryId)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (machineId && !utilService.isValidObjectId(machineId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const category = await maintenanceCategoryService.findOne({ _id: maintenanceCategoryId, workspaceId }, {
                projection: "name",
                useLean: true
            });
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
                        lastMaintenanceDate: entry.lastMaintenanceDate,
                        nextMaintenanceDate: entry.nextMaintenanceDate,
                        completedBy: entry.completedBy || null,
                        completedByMobile: entry.completedByMobile || null,
                        remarks: entry.remarks || null,
                        updatedAt: entry.updatedAt || null,
                        isCurrent: false
                    });
                });

                if (record.lastMaintenanceDate) {
                    list.push({
                        machineId: record.machineId,
                        machineCode: machine.machineCode || '',
                        machineName: machine.machineName || '',
                        lastMaintenanceDate: record.lastMaintenanceDate,
                        nextMaintenanceDate: record.nextMaintenanceDate,
                        completedBy: record.completedBy || null,
                        completedByMobile: record.completedByMobile || null,
                        remarks: record.remarks || null,
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

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updateAlert: async (req, res, next) => {
        try {
            const body = req.body;
            utilService.checkRequiredParams(['nextMaintenanceDate', 'lastMaintenanceDate'], body);

            const mdId = req.params.id;
            if (!utilService.isValidObjectId(mdId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const maintenanceData = await maintenanceDataService.findOne({ _id: mdId }, { useLean: true });
            if (!maintenanceData) {
                throw global.config.message.RECORD_NOT_FOUND;
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
                remarks: body.remarks || '',
                completedBy: '',
                completedByMobile: '',
                $push: { history: historyEntry }
            };
            if (typeof body.completedBy && body.completedBy?.trim()) {
                updatedData.completedBy = body.completedBy.trim();
            }
            if (typeof body.completedByMobile && body.completedByMobile?.trim()) {
                updatedData.completedByMobile = body.completedByMobile.trim();
            }

            const entry = await maintenanceDataService.findByIdAndUpdate(maintenanceData._id, updatedData);

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}