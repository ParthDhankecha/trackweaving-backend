const bcrypt = require('bcrypt');


module.exports = {
    login: async (email, password) => {
        if (!email || !password) return null;
        if (typeof email !== 'string' || typeof password !== 'string') return null;

        email = email.trim().toLowerCase();

        const query = await adminUserModel.findOne({ email: email }, 'email userType password').lean();
        if (!query) return null;

        const isMatch = await bcrypt.compare(password, query.password);
        if (!isMatch) return null;

        return query;
    }
}
