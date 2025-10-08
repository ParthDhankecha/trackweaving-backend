const machineGroupService = require("../../services/machineGroupService");
const machineService = require("../../services/machineService");
const { log, checkRequiredParams } = require("../../services/utilService");
const machineLogsService = require("../../services/machineLogsService");
const moment = require("moment");

module.exports = {
    getReport: async (req, res, next) => {
        try {
            const fields = ['machineIds', 'reportType', 'startDate', 'endDate'];
            await checkRequiredParams(fields, req.body);
            if(Array.isArray(req.body.machineIds) && req.body.machineIds.length === 0){
                throw global.config.message.BAD_REQUEST;
            }

            switch (req.body.reportType) {
                case "productionShiftWise":
                    let condition = {
                        machineId: { $in: req.body.machineIds },
                        workspaceId: req.user.workspaceId,
                        createdAt: {
                            $gte: moment(new Date(req.body.startDate).toISOString()).startOf('day'),
                            $lte: moment(new Date(req.body.endDate).toISOString()).endOf('day')
                        }
                    };
                    if(req.body.shift){
                        condition.shift = { $in: req.body.shift };
                    }
                    let machines = await machineService.find({ _id: { $in: req.body.machineIds }, workspaceId: req.user.workspaceId }, { projection: { machineCode: 1 }, useLean: true });
                    let reportData = await machineLogsService.find(condition, { projection: { rawData: false, workspaceId: false, lastStopTime: false, lastStartTime: false, picksTotal: false, setPicks: false, stop: false, alarmsActive: false, loomStateCode: false, isDeleted: false }, sort: { machineId: 1 }, useLean: true });
                    let finalData = [];
                    let totalNumbers = {
                        totalPicks: 0,
                        totalEfficiency: 0,
                        totalProdMeter: 0,
                        avgPicks: 0,
                        avgCount: 0
                    };
                    for(let data of reportData) {
                        let reportDate = moment(data.createdAt).startOf('day').toISOString();
                        let obj = {};
                        if(!finalData[reportDate]) {
                            if(req.body.shift.includes(global.config.SHIFT_TYPE.DAY)) {
                                obj["dayShift"] = {
                                    list: [],
                                    totalPicks: 0,
                                    efficiency: 0,
                                    prodMeter: 0,
                                    avgPicks: 0
                                };
                            }
                            finalData[reportDate] = obj;
                        }
                        if(data.shift === global.config.SHIFT_TYPE.NIGHT && !finalData[reportDate].nightShift) {
                            finalData[reportDate]["nightShift"] = {
                                list: [],
                                totalPicks: 0,
                                efficiency: 0,
                                prodMeter: 0,
                                avgPicks: 0
                            }
                        }
                        
                        let shift = data.shift == global.config.SHIFT_TYPE.DAY ? "dayShift" : "nightShift";
                        data.machineCode = machines.find(m => m._id.toString() === data.machineId.toString())?.machineCode || '';
                        data.stopsData = {};
                        let totalStopCount = 0;
                        let totalStopDuration = 0;
                        for(let key in data.stopsCount) {
                            data.stopsData[key] = {
                                count: data.stopsCount[key].count || 0,
                                duration: data.stopsCount[key].duration || 0
                            };
                            totalStopCount += data.stopsData[key].count || 0;
                            totalStopDuration += data.stopsData[key].duration || 0;
                            const totalSeconds = data.stopsData[key].duration;
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor((totalSeconds % 3600) / 60);
                            data.stopsData[key].duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        }
                        data.stopsData.total = {
                            count: totalStopCount,
                            duration: `${Math.floor(totalStopDuration / 3600).toString().padStart(2, '0')}:${Math.floor((totalStopDuration % 3600) / 60).toString().padStart(2, '0')}`
                        }
                        let runTime = data.runTime.split(':');
                        if(runTime.length > 1) {
                            let runHours = parseInt(runTime[0]);
                            let runMins = parseInt(runTime[1]);
                            runMins += runHours * 60;
                            runMins -= Math.floor(totalStopDuration / 60);
                            data.runTime = `${Math.floor(runMins / 60).toString().padStart(2, '0')}:${(runMins % 60).toString().padStart(2, '0')}`;
                        }
                        finalData[reportDate][shift].list.push(data);
                        finalData[reportDate][shift].totalPicks += data.picksCurrentShift || 0;
                        finalData[reportDate][shift].efficiency += data.efficiencyPercent || 0;
                        finalData[reportDate][shift].prodMeter += data.pieceLengthM || 0;
                    }
                    let parsedData = [];
                    for(let date in finalData) {
                        if(finalData[date].dayShift) {
                            finalData[date].dayShift.avgPicks = finalData[date].dayShift.list.length ? Math.round((finalData[date].dayShift.totalPicks / finalData[date].dayShift.list.length)) : 0;
                            finalData[date].dayShift.efficiency = finalData[date].dayShift.list.length ? Math.round((finalData[date].dayShift.efficiency / finalData[date].dayShift.list.length)) : 0
                            totalNumbers.totalPicks += finalData[date].dayShift.totalPicks;
                            totalNumbers.totalEfficiency += finalData[date].dayShift.efficiency;
                            totalNumbers.totalProdMeter += finalData[date].dayShift.prodMeter;
                            totalNumbers.avgCount += 1;
                            totalNumbers.avgPicks = finalData[date].dayShift.avgPicks;
                        }
                        if(finalData[date].nightShift) {
                            finalData[date].nightShift.avgPicks = finalData[date].nightShift.list.length ? Math.round((finalData[date].nightShift.totalPicks / finalData[date].nightShift.list.length)) : 0;
                            finalData[date].nightShift.efficiency = finalData[date].nightShift.list.length ? Math.round((finalData[date].nightShift.efficiency / finalData[date].nightShift.list.length)) : 0
                            totalNumbers.totalPicks += finalData[date].nightShift.totalPicks;
                            totalNumbers.totalEfficiency += finalData[date].nightShift.efficiency;
                            totalNumbers.totalProdMeter += finalData[date].nightShift.prodMeter;
                            totalNumbers.avgCount += 1;
                            totalNumbers.avgPicks = finalData[date].nightShift.avgPicks;
                        }
                        parsedData.push({
                            reportDate: date,
                            reportData: finalData[date]
                        });
                    }

                    return res.ok({
                        list: parsedData,
                        totalPicks: totalNumbers.totalPicks,
                        totalEfficiency: Math.round((totalNumbers.totalEfficiency / totalNumbers.avgCount) || 0),
                        avgProdMeter: totalNumbers.totalProdMeter,
                        avgPicks: Math.round((totalNumbers.avgPicks / totalNumbers.avgCount) || 0)
                    })
                    break;

                case 'stopageFilter':
                    let stopageFields = ['']
                    break;

                default:
                    break;
            }
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}