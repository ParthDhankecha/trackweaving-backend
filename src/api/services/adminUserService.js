const { compare } = require('bcrypt');

module.exports = {
    login: async (email, password) => {
        const query = await adminUserModel.findOne({ email: email }, '+password +userType').lean();
        if (!query) {
            return null;
        }
        const isMatch = await compare(password, query.password);
        if (!isMatch) {
            return null;
        }
        return query;
    }
}
