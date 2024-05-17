'use strict';
const { Client } = require('pg');
const { getKey } = require('../shared/helper');
const { getRedisData, setRedisData } = require('../shared/redis-functions');

exports.handler = async (event) => {
  let redshiftClient;
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

    const redisRes = await getRedisData({ key: keyForRedis });
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

    const adjustedPageSize = parseInt(Size, 10);

    // Calculate the offset based on the page number and page size
    const offset = (parseInt(Page, 10) - 1) * adjustedPageSize ?? 0;

    // Set default page size to 10 if not specified

    // Construct the WHERE clause based on the provided parameters
    const whereConditions = ['a.is_deleted = \'N\'AND a."finalized date" IS NOT NULL']; // Always include the mandatory condition

    if (SourceSystem) {
      whereConditions.push(`a."source system" = '${SourceSystem}'`);
    }
    if (FileNumber) {
      whereConditions.push(`a."file number" = '${FileNumber}'`);
    }
    if (StartDate && EndDate) {
      const startDateString = StartDate.split('T')[0];
      const endDateString = EndDate.split('T')[0];
      whereConditions.push(
        `a."file date" >= '${startDateString}' AND a."file date" <= '${endDateString}'`
      );
    }

    if (HouseWayBill) {
      whereConditions.push(`a."house waybill" = '${HouseWayBill}'`);
    }
    if (MasterBill) {
      whereConditions.push(`b."master waybill" = '${MasterBill}'`);
    }
    if (VendorID) {
      whereConditions.push(`a."vendor id" = '${VendorID}'`);
    }
    if (InvoiceNumber) {
      whereConditions.push(`a."invoice number" = '${InvoiceNumber}'`);
    }

    // Construct the WHERE clause string
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Define the Redshift connection parameters
    const redshiftParams = {
      port: process.env.REDSHIFT_PORT,
      user: process.env.REDSHIFT_USER,
      password: process.env.REDSHIFT_PASSWORD,
      database: process.env.REDSHIFT_DATABASE,
      // host: 'omni-dw-prod.cnimhrgrtodg.us-east-1.redshift.amazonaws.com',
      host: process.env.REDSHIFT_HOST,
    };

    // Create a new Redshift client
    redshiftClient = new Client(redshiftParams);

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
a."source system" || '-' || a."file number" || '-' || b."house waybill" || '-' || b."master waybill" || '-' || a."invoice number" || '-' || a."vendor id" || '-' || a."service id" || '-' || a."vendor invoice nbr" || '-' || a."consol number" AS id,
        a."source system" AS source_system,
        a."file number" AS file_number,
        b."house waybill" AS house_waybill,
        b."master waybill" AS master_waybill,
        TO_CHAR(a."file date" , 'YYYY-MM-DD HH24:MI:SS') as file_date,
        a.division AS division,
        a."invoice number" AS invoice_number,
        a."vendor id" AS vendor_id,
        a."vendor name" AS vendor_name,
        a."service id" AS service_id,
        a."vendor invoice nbr" AS vendor_invoice_number,
        a."invoice sequence number" AS invoice_sequence_number,
        a."revenue station" AS revenue_station,
        a."controlling station" AS controlling_station,
        a."bill to number" AS bill_to_number,
        a."bill to customer" AS bill_to_customer,
        a."sales rep" AS sales_rep,
        a."account manager" AS account_manager,
        a."consol number" AS consol_number,
        a."charge code" AS charge_code,
        TO_CHAR(a."invoice date" , 'YYYY-MM-DD HH24:MI:SS') as invoice_date,
        TO_CHAR(a."finalized date" , 'YYYY-MM-DD HH24:MI:SS') as finalized_date,
        TO_CHAR(a."vendor complete date" , 'YYYY-MM-DD HH24:MI:SS') as vendor_complete_date,
        a."finalized by" AS finalized_by,
        a."updated by" AS updated_by,
        a.tax AS tax,
        a.total AS total,
        a.currency AS currency,
        a."original total" AS original_total
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

    // Execute main SQL query

    const [countResult, sqlResult] = await Promise.all([
      await redshiftClient.query(countQuery),
      await redshiftClient.query(sqlQuery),
    ]);
    console.info(
      '🙂 -> file: financesearch.js:178 -> exports.handler= -> countQuery, sqlQuery:',
      countQuery,
      sqlQuery
    );
    // Extract total items from count result
    const totalItems = parseInt(countResult.rows[0].totalitems, 10);

    // Extract data from SQL result
    const formattedResults = sqlResult.rows;

    // Calculate total number of pages
    const totalPage = Math.ceil(totalItems / adjustedPageSize);

    // Close the connection to the Redshift cluster
    await redshiftClient.end();

    await setRedisData({
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
  } finally {
    if (redshiftClient) {
      await redshiftClient.end();
    }
  }
};
