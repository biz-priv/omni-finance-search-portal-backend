'use strict';
const { getClient } = require('./redis-client');

async function setRedisData({ key, value }) {
  const client = getClient;
  console.info('🙂 -> file: redis-functions.js:6 -> setRedisData -> client:', client);
  return await client.set(key, JSON.stringify(value));
}

async function getRedisData({ key }) {
  const client = getClient;
  console.info('🙂 -> file: redis-functions.js:12 -> getRedisData -> client:', client);
  return JSON.parse(await client.get(key));
}

module.exports = {
  setRedisData,
  getRedisData,
};
