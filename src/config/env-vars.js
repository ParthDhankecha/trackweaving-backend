const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env')});


module.exports = {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  mongo: {
    uri: process.env.NODE_ENV === 'development' ? process.env.MONGO_URI_DEV : process.env.MONGO_URI_PROD,
    /**
     * When strict option is set to true , Mongoose will ensure that only the fields that are specified in your Schema will be saved in the database,
     * and all other fields will not be saved (if some other fields are sent).
     * In simple term, the strict option, ensures that values passed to our model constructor that were not specified in our schema do not get saved to the db.
     * Mongoose supports a separate strictQuery option to avoid strict mode for query filters
     */
    strictQuery: true,
    options: {
      /**
       * By default, mongoose will automatically build indexes defined in your schema when it connects. This is great for development,
       * but not ideal for large production deployments, because index builds can cause performance degradation.
       * If you set autoIndex to false, mongoose will not automatically build indexes for any model associated with this connection
       */
      autoIndex: false,
      /**
       * For long running applications, it is often prudent to enable keepAlive with a number of milliseconds.
       * Without it, after some period of time you may start to see "connection closed" errors for what seems like no reason.
       * If so, after reading this, you may decide to enable keepAlive
       */
      keepAlive: true,
      /**
       * The maximum number of sockets the MongoDB driver will keep open for this connection. By default, maxPoolSize is 100.
       * Keep in mind that MongoDB only allows one operation per socket at a time, so you may want to increase this if you find
       * you have a few slow queries that are blocking faster queries from proceeding. See Slow Trains in MongoDB and Node.js.
       * You may want to decrease maxPoolSize if you are running into connection limits
       */
      maxPoolSize: 10, // Default maxPoolSize: 100
      useNewUrlParser: true, /** set by mongoose, by default true. */
      useUnifiedTopology: true, /** set by mongoose, by default true. */
      /**
       * Whether to connect using IPv4 or IPv6. This option passed to Node.js' dns.lookup() function.
       * If you don't specify this option, the MongoDB driver will try IPv6 first and then IPv4 if IPv6 fails
       */
      // family: 4,

      /**
       * Support dropped before mongoose v-6.0.0
       * useCreateIndex: true, // set by mongoose, by default true.
       * useFindAndModify: false, // set by mongoose, by default false.
       * bufferMaxEntries: 0,
       */
    },
  },
  serverResponseRecordLimit: process.env.RECORD_LIMIT ?? 50, // Default record limit for server responses
  masterOTP: process.env.MASTER_OTP, // Master OTP for admin access
  // encryptionKey: process.env.ENCRYPTION_KEY,
};
