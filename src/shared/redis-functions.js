'use strict';
const { getClient } = require('./redis-client');

async function setRedisData({ key, value }) {
  const client = await getClient();
  return await client.set(key, JSON.stringify(value));
}

async function getRedisData({ key }) {
  const client = await getClient();
  return JSON.parse(await client.get(key));
}

module.exports = {
  setRedisData,
  getRedisData,
};
