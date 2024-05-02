'use strict';

const redis = require('redis');

// Promisify all the functions exported by node_redis.
// bluebird.promisifyAll(redis);

// Create a client and connect to Redis using configuration
// from config.json.
const cluster = redis.createCluster({
  rootNodes: [
    {
      url: 'master.finance-search-portal-redis-dev.cbgmpe.use1.cache.amazonaws.com:6379',
    },
    {
      url: 'replica.finance-search-portal-redis-dev.cbgmpe.use1.cache.amazonaws.com:6379',
    },
  ],
  defaults: {
    password: '#J3>u_fWD&8y_H3yl!',
  },
});

// const client = redis.createClient();

// const client = await redis.createClient()
//   .on('error', err => console.log('Redis Client Error', err))
//   .connect();

// This is a catch all basic error handler.

module.exports = {
  /**
   * Get the application's connected Redis client instance.
   *
   * @returns {Object} - a connected node_redis client instance.
   */
  getClient: async () =>
    await cluster.on('error', (err) => console.info('Redis Client Error', err)).connect(),
};
