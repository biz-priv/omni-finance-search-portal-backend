'use strict';
const AWS = require('aws-sdk');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

function toPascalCase(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toPascalCase(item));
  }

  return Object.keys(obj).reduce((acc, key) => {
    const pascalKey = key.replace(/(\w)(\w*)/g, (match, firstChar, rest) => {
      return firstChar.toUpperCase() + rest.toLowerCase();
    }).replace(/\s+/g, ''); // Remove spaces between keys
    
    let value = obj[key];
    if (value instanceof Date) {
      value = value.toISOString(); // Convert Date objects to ISO string
    }
    
    acc[pascalKey] = toPascalCase(value); // Recursively apply toPascalCase
    return acc;
  }, {});
}

exports.handler = async (event) => {
  try {
    // Extract input parameters from the API request
    const {
      SourceSystem,
      FileNumber,
      CreatedDate,
      Page,
      PageSize,
      SortBy,
      Ascending = false,
    } = event.queryStringParameters || {};

    // Calculate the offset based on the page number and page size
    const offset = (parseInt(Page, 10) - 1) * (PageSize || 10) || 0;

    // Construct the WHERE clause based on the provided parameters
    const whereConditions = ['a.is_deleted = \'N\'AND a."invoice date" IS NOT NULL']; // Always include the mandatory condition

    if (SourceSystem) {
      whereConditions.push(`a."source system" = '${SourceSystem}'`);
    }
    if (FileNumber) {
      whereConditions.push(`a."file number" = '${FileNumber}'`);
    }
    if (CreatedDate) {
      whereConditions.push(`a."file date" = '${CreatedDate}'`);
    }

    // Construct the WHERE clause string
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Define the Redshift connection parameters
    const redshiftParams = {
      port: process.env.REDSHIFT_PORT,
      user: process.env.REDSHIFT_USER,
      password: process.env.REDSHIFT_PASSWORD,
      database: process.env.REDSHIFT_DATABASE,
      host: process.env.REDSHIFT_HOST,
    };

    // Create a new Redshift client
    const redshiftClient = new Client(redshiftParams);

    // Connect to the Redshift cluster
    await redshiftClient.connect();
    
    const countQuery = `
      SELECT COUNT(*) AS totalItems
      FROM datamart.ap_invoices a
      JOIN datamart.shipment_extract b
      ON a."source system" = b."source system"
      AND a."file number" = b."file number"
      ${whereClause}`;

    // Execute the count query as a promise
    const countResult = await new Promise((resolve, reject) => {
      redshiftClient.query(countQuery, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    const totalItems = parseInt(countResult.rows[0].totalitems, 10);

    // Construct the SQL query with the dynamic WHERE clause, sorting, and pagination
    const sqlQuery = `
      SELECT
        a."source system",
        a."file number",
        b."house waybill",
        b."master waybill",
        a."file date",
        a.division,
        a."invoice number",
        a."vendor id",
        a."vendor name",
        a."service id",
        a."vendor invoice nbr",
        a."invoice sequence number",
        a."revenue station",
        a."controlling station",
        a."bill to number",
        a."bill to customer",
        a."sales rep",
        a."account manager",
        a."consol number",
        a."charge code",
        a."invoice date",
        a."finalized date",
        a."vendor complete date",
        a."finalized by",
        a."updated by",
        a.tax,
        a.total,
        a.currency,
        a."original total"
      FROM
        datamart.ap_invoices a
      JOIN
        datamart.shipment_extract b
      ON
        a."source system" = b."source system"
        AND a."file number" = b."file number"
      ${whereClause}
      ORDER BY
        ${SortBy || 'a."invoice date"'} ${Ascending ? 'ASC' : 'DESC'}
      LIMIT
        ${PageSize || 10}  -- Default page size is 10
      OFFSET
        ${offset}`;

    // Execute the SQL query
    const result = await redshiftClient.query(sqlQuery);
    const formattedResults = [];
    for (const row of result.rows) {
        const formattedRow = { ...toPascalCase(row) };
        formattedRow.uniqueId = uuidv4(); // Generate UUID for each row
        formattedResults.push(formattedRow);
    }

    // Calculate total number of pages
    const totalPage = Math.ceil(totalItems / 10);

    const pascalCaseResults = toPascalCase(formattedResults);

    // Close the connection to the Redshift cluster
    await redshiftClient.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: pascalCaseResults,
        currentPage: parseInt(Page, 10) || 1,
        totalItems,
        totalPage,
        size: formattedResults.length,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
