const moment = require('moment');
const shiftWiseCommentService = require('../../services/shiftWiseCommentService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    getShiftWiseComments: async (req, res, next) => {
        try {
            const body = req.body;
            checkRequiredParams(['date'], body);
            const condition = {
                workspaceId: req.user.workspaceId,
                date: {
                    $gte: moment(new Date(body.date).toISOString()).startOf('month'),
                    $lt: moment(new Date(body.date).toISOString()).endOf('month')
                },
            };
            if (body.shift && ['day', 'night'].includes(body.shift)) {
                condition.shift = body.shift;
            }
            if (body.machineId) {
                condition.machineId = body.machineId;
            }
            const shiftWiseComments = await shiftWiseCommentService.find({ ...condition });

            return res.ok({ list: shiftWiseComments }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateShiftWiseComment: async (req, res, next) => {
        try {
            const body = req.body;
            if (!body.list || !Array.isArray(body.list)) {
                throw global.config.message.BAD_REQUEST;
            }
            for (const comment of body.list) {
                checkRequiredParams(['machineId', 'date', 'shift'], comment);
                if (!['day', 'night'].includes(comment.shift)) {
                    throw global.config.message.INVALID_SHIFT;
                }
            }

            for (const comment of body.list) {
                await shiftWiseCommentService.updateOne({
                    workspaceId: req.user.workspaceId,
                    machineId: comment.machineId,
                    date: moment(new Date(comment.date).toISOString()).startOf('day'),
                    shift: comment.shift
                }, { comment: comment.comment ?? '' });
            }

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}