'use strict';
const { Client } = require('pg');

exports.handler = async (event) => {
  try {
    // Extract input parameters from the API request
    const {
      SourceSystem,
      FileNumber,
      CreatedDate,
      Page,
      Size,
      SortBy,
      Ascending = false,
    } = event.queryStringParameters || {};

    // Calculate the offset based on the page number and page size
    const offset = (parseInt(Page, 10) - 1) * (Size || 10) || 0;

    // Set default page size to 10 if not specified
    const adjustedPageSize = Size ? Math.min(parseInt(Size, 10), 100) : 10;

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

    // Define count query
    const countQuery = `
      SELECT COUNT(*) AS totalItems
      FROM datamart.ap_invoices a
      JOIN datamart.shipment_extract b
      ON a."source system" = b."source system"
      AND a."file number" = b."file number"
      ${whereClause}`;

    // Define main SQL query
    const sqlQuery = `
      SELECT
        a."source system" || '-' || a."file number" || '-' || b."house waybill" || '-' || b."master waybill" AS Id,
        a."source system" AS Source_System,
        a."file number" AS File_Number,
        b."house waybill" AS House_Waybill,
        b."master waybill" AS Master_Waybill,
        a."file date" AS File_Date,
        a.division AS Division,
        a."invoice number" AS Invoice_Number,
        a."vendor id" AS Vendor_Id,
        a."vendor name" AS Vendor_Name,
        a."service id" AS Service_Id,
        a."vendor invoice nbr" AS Vendor_Invoice_Number,
        a."invoice sequence number" AS Invoice_Sequence_Number,
        a."revenue station" AS Revenue_Station,
        a."controlling station" AS Controlling_Station,
        a."bill to number" AS Bill_To_Number,
        a."bill to customer" AS Bill_To_Customer,
        a."sales rep" AS Sales_Rep,
        a."account manager" AS Account_Manager,
        a."consol number" AS Consol_Number,
        a."charge code" AS Charge_Code,
        a."invoice date" AS Invoice_Date,
        a."finalized date" AS Finalized_Date,
        a."vendor complete date" AS Vendor_Complete_Date,
        a."finalized by" AS Finalized_By,
        a."updated by" AS Updated_By,
        a.tax AS Tax,
        a.total AS Total,
        a.currency AS Currency,
        a."original total" AS Original_Total
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
        ${adjustedPageSize} -- Use the adjusted PageSize here
      OFFSET
        ${offset}`;

    // const countResult = await redshiftClient.query(countQuery);

    // Execute main SQL query
    // const sqlResult = await redshiftClient.query(sqlQuery);
    const [countResult, sqlResult] = await Promise.all([
      await redshiftClient.query(countQuery),
      await redshiftClient.query(sqlQuery),
    ]);
    // Extract total items from count result
    const totalItems = parseInt(countResult.rows[0].totalitems, 10);

    // Extract data from SQL result
    const formattedResults = sqlResult.rows;

    // Calculate total number of pages
    const totalPage = Math.ceil(totalItems / adjustedPageSize);

    // Close the connection to the Redshift cluster
    await redshiftClient.end();

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
        Size: formattedResults.length,
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
