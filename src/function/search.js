'use strict';
const {
  getKey,
  queryDatabase,
  getWhereCondition,
  getPageSize,
  getOffset,
} = require('../shared/helper');
const { get, set } = require('../shared/redis-client');

exports.handler = async (event) => {
  try {
    // Extract input parameters from the API request
    const {
      SourceSystem,
      FileNumber,
      StartDate,
      EndDate,
      HouseWayBill,
      MasterBill,
      VendorID,
      InvoiceNumber,
      Page = 1,
      Size = 10,
      SortBy,
      Ascending = false,
    } = event.queryStringParameters || {};

    const keyForRedis = getKey({
      SourceSystem,
      FileNumber,
      StartDate,
      EndDate,
      HouseWayBill,
      MasterBill,
      VendorID,
      InvoiceNumber,
      Page,
      Size,
      SortBy,
      Ascending,
    });

    console.info(
      '🙂 -> file: financesearch.js:25 -> exports.handler= -> keyForRedis:',
      keyForRedis
    );

    const redisRes = await get({ key: keyForRedis });
    console.info('🙂 -> file: financesearch.js:42 -> exports.handler= -> redisRes:', redisRes);

    if (redisRes) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(redisRes),
      };
    }

    const adjustedPageSize = getPageSize({ Size });

    // Calculate the offset based on the page number and page size
    const offset = getOffset({ Page, Size });

    // Construct the WHERE clause based on the provided parameters
    const whereClause = getWhereCondition(event.queryStringParameters);

    const [countResult, sqlResult] = await queryDatabase({
      where: whereClause,
      adjustedPageSize,
      Ascending,
      offset,
      SortBy,
    });
    // Extract total items from count result
    const totalItems = parseInt(countResult.rows[0].totalitems, 10);

    // Extract data from SQL result
    const formattedResults = sqlResult.rows;

    // Calculate total number of pages
    const totalPage = Math.ceil(totalItems / adjustedPageSize);

    // Close the connection to the Redshift cluster
    await set({
      key: keyForRedis,
      value: {
        Data: formattedResults,
        CurrentPage: parseInt(Page, 10) || 1,
        TotalPage: totalPage,
        Size,
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Data: formattedResults,
        CurrentPage: parseInt(Page, 10) || 1,
        TotalPage: totalPage,
        Size,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
