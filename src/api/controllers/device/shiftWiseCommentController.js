const shiftWiseCommentService = require("../../services/shiftWiseCommentService");
const { log, checkRequiredParams } = require("../../services/utilService");
const moment = require("moment");

module.exports = {
    getShiftWiseComments: async (req, res, next) => {
        try {
            await checkRequiredParams(['date'], req.body);
            let condition = {
                workspaceId: req.user.workspaceId,
                date: { $gte: moment(new Date(req.body.date).toISOString()).startOf('month'), $lt: moment(new Date(req.body.date).toISOString()).endOf('month') },
            }
            if(req.body.shift && ['day', 'night'].includes(req.body.shift)) {
                condition.shift = req.body.shift;
            }
            if(req.body.machineId) {
                condition.machineId = req.body.machineId;
            }
            console.log("condition", condition);
            const shiftWiseComments = await shiftWiseCommentService.find({ ...condition });

            return res.ok({ list: shiftWiseComments }, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    updateShiftWiseComment: async (req, res, next) => {
        try {
            console.log("req.body", req.body);
            if(!req.body.list || !Array.isArray(req.body.list)) {
                throw global.config.message.BAD_REQUEST;
            }
            for(let item of req.body.list) {
                await checkRequiredParams(['machineId', 'date', 'shift', 'comment'], item);
                if(!['day', 'night'].includes(item.shift)) {
                    throw global.config.message.INVALID_SHIFT;
                }
            }
            
            for(let comment of req.body.list) {
                await shiftWiseCommentService.updateOne({ workspaceId: req.user.workspaceId, machineId: comment.machineId, date: moment(new Date(comment.date).toISOString()).startOf('day'), shift: comment.shift }, {comment: comment.comment });
            }

            return res.ok({}, global.config.message.UPDATED);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}