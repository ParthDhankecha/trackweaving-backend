const authService = require("../../services/authService");
const usersService = require("../../services/usersService");
const utilService = require("../../services/utilService");
const { log, checkRequiredParams } = require("../../services/utilService");
const workspaceService = require("../../services/workspaceService");



module.exports = {
    create: async (req, res, next) => {
        try {
            checkRequiredParams(['data', 'date'], req.body);
            const reqBody = await authService.decryptData(req.body);
            checkRequiredParams(['name', 'workspaceName', 'userName', 'password'], reqBody);

            const { workspaceName, GSTNo, isActive, shiftType, startTime, endTime, ...rest } = reqBody;

            const user = await usersService.findOne({ userName: rest.userName.trim() });
            if (user) {
                throw global.config.message.IS_DUPLICATE;
            }
            const newUser = await authService.createUser(rest);
            
            const workspaceObj = {
                firmName: workspaceName,
                userId: newUser._id
            };
            
            if(reqBody?.dayShift){
                workspaceObj.dayShift = reqBody.dayShift;
            }
            if(reqBody?.nightShift){
                workspaceObj.nightShift = reqBody.nightShift;
            }

            if (GSTNo) {
                workspaceObj.GSTNo = GSTNo;
            }
            if (isActive || isActive === false) {
                workspaceObj.isActive = isActive;
            }
            const workspace = await workspaceService.create(workspaceObj);
            newUser.workspaceId = workspace._id;
            await newUser.save();

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getList: async (req, res, next) => {
        try {
            const queryObj = {};
            const body = req.body || {};
            if(body.hasOwnProperty('isActive') && (body.isActive === true || body.isActive === false)){
                queryObj.isActive = body.isActive;
            }

            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };
            const queryOptions = utilService.getFilter(pageObj);
            queryOptions.populate = { path: 'userId', select: 'fullname userName' };

            const result = await workspaceService.find(queryObj, queryOptions);
            const totalCount = await workspaceService.countDocuments(queryObj);

            const response = {
                list: result,
                totalCount: totalCount
            }

            return res.ok(response, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getAllList: async (req, res, next) => {
        try {
            const projection = { firmName: 1 };
            const result = await workspaceService.find({}, { projection});

            return res.ok(result, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)      
        }
    },

    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            
            let populate = { path: 'userId', select: 'fullname userName' };
            const workspace = await workspaceService.findOne({ _id: req.params.id }, {populate});
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(workspace, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    updateById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            const body = req.body;

            if(Object.keys(body).length === 0){
                throw global.config.message.BAD_REQUEST;
            }
            const workspace = await workspaceService.findOne({ _id: req.params.id });
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const updateObj = {};
            if(body?.workspaceName){
                updateObj.firmName = body.workspaceName;
            }
            if(body?.GSTNo || body?.GSTNo === ''){
                updateObj.GSTNo = body.GSTNo;
            }
            if(body.hasOwnProperty('isActive') && (body.isActive === true || body.isActive === false)){
                updateObj.isActive = body.isActive;
            }
            
            if(body?.dayShift){
                updateObj.dayShift = body.dayShift;
            }
            if(body?.nightShift){
                updateObj.nightShift = body.nightShift;
            }

            if(Object.keys(updateObj).length === 0){
                throw global.config.message.BAD_REQUEST;
            }
            
            const updatedWorkspace = await workspaceService.findByIdAndUpdate(workspace._id, updateObj, {populate: { path: 'userId', select: 'fullname userName' }});

            return res.ok(updatedWorkspace, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    }
}