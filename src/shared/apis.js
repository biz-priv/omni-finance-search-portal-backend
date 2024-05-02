'use strict';
const axios = require('axios');

axios.interceptors.request.use(async (config) => {
  config.baseURL = 'http://localhost:4000/dev';
  // config.baseURL = 'https://sfo80gy5yf.execute-api.us-east-1.amazonaws.com/dev';
  return config;
});

async function getTableData(params) {
  const { data } = await axios.get('/search', { params });
  return data;
}

module.exports = { getTableData };
