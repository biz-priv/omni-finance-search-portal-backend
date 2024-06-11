'use strict';

const Redis = require('ioredis');

// const DEFAULT_TIMEOUT = 4000;
let cacheClient = null;

if (!cacheClient && typeof process.env.REDIS_ENDPOINT === 'string') {
  const connectParams = process.env.REDIS_ENDPOINT.split(':');
  console.info('Connecting to redis', connectParams);
  try {
    cacheClient = new Redis({
      host: connectParams[0],
      port: connectParams[1],
      connectTimeout: 5000,
      reconnectOnError(err) {
        console.info('Reconnect on error', err);
        const targetError = 'READONLY';
        if (err.message.slice(0, targetError.length) === targetError) {
          // Only reconnect when the error starts with "READONLY"
          return true;
        }
        return false;
      },
      retryStrategy(times) {
        console.info('Redis Retry', times);
        if (times >= 3) {
          return undefined;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    console.info('Create Redis Client success');
  } catch (error) {
    console.error('Connect to redis failed', error);
  }
}

async function set({ key, value }) {
  try {
    if (cacheClient) {
      console.info(`SET cache key=${key}`, value);
      const res = await cacheClient.set(key, JSON.stringify(value));
      return res;
    }
    console.info('Cache is not available');
  } catch (err) {
    console.error('Write cache error', err);
  }
  return false;
}

async function get({ key }) {
  try {
    if (cacheClient) {
      let res = await cacheClient.get(key);
      if (res) {
        res = JSON.parse(res);
      }
      console.info(`Read cache key=${key}`, res);
      return res;
    }
    console.info('Cache is not available');
  } catch (err) {
    console.error('Read cache error', err);
  }
  return false;
}

async function remove({ key }) {
  await cacheClient.del(key);
}

module.exports = {
  set,
  get,
  remove,
};
