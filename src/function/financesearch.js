'use strict';
const AWS = require('aws-sdk');
const { Client } = require('pg');

exports.handler = async (event) => {
  try {
    // Extract input parameters from the API request
    const {
      sourceSystem,
      fileNumber,
      createdDate,
      page,
      pageSize,
      sortBy,
      ascending = false,
    } = event.queryStringParameters || {};

    // Calculate the offset based on the page number and page size
    const offset = (page - 1) * (pageSize || 10) || 0;

    // Construct the WHERE clause based on the provided parameters
    const whereConditions = [];

    if (sourceSystem) {
      whereConditions.push(`a."source system" = '${sourceSystem}'`);
    }
    if (fileNumber) {
      whereConditions.push(`a."file number" = '${fileNumber}'`);
    }
    if (createdDate) {
      whereConditions.push(`a."file date" = '${createdDate}'`);
    }

    // Construct the WHERE clause string
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    } else {
      // If no parameters are provided, use default conditions
      whereClause = 'WHERE a.is_deleted = \'N\' AND a."invoice date" IS NOT NULL';
    }

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
                ${sortBy || 'a."invoice date"'} ${ascending ? 'ASC' : 'DESC'}
            LIMIT
                ${pageSize || 10}  -- Default page size is 10
            OFFSET
                ${offset}`;

    // Execute the SQL query
    const result = await redshiftClient.query(sqlQuery);
    const formattedResults = result.rows;

    // Close the connection to the Redshift cluster
    await redshiftClient.end();

    return {
      statusCode: 200,
      body: JSON.stringify(formattedResults),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
