'use strict';
const { Client } = require('pg');

function getKey(params = {}) {
  console.info('🙂 -> file: helper.js:4 -> getKey -> params:', params);
  if (params) {
    const filteredObject = Object.keys(params).reduce((acc, key) => {
      if (params[key]) {
        acc[key] = params[key];
      }
      return acc;
    }, {});
    const keyValue = Object.entries(filteredObject).map(([key, value]) => `${key}=${value}`);
    return ['root', ...keyValue].join(':');
  }
  return 'root';
}

function getAllCombinations(arrays) {
  if (arrays.length === 0) {
    return [[]];
  }

  // Get the first array and the rest of them
  const firstArray = arrays[0];
  const restArrays = arrays.slice(1);

  // Get all combinations from the rest of the arrays recursively
  const restCombinations = getAllCombinations(restArrays);

  // Prepare the output array
  const allCombinations = [];

  // Combine each element of the first array with each combination from the rest
  firstArray.forEach((firstElement) => {
    restCombinations.forEach((combination) => {
      allCombinations.push([firstElement, ...combination]);
    });
  });

  return allCombinations;
}

function decomposeObjects(array) {
  const newArray = [];
  array.forEach((obj) => {
    // Iterate over each key in the object
    // eslint-disable-next-line guard-for-in
    for (const key in obj) {
      // Create a new object for each key and push it to the newArray
      const newObj = {};
      newObj[key] = obj[key];
      newArray.push(newObj);
    }
  });

  return newArray;
}

function getMainQuery({ where, SortBy, Ascending, adjustedPageSize, offset }) {
  let query = `
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
      ${where}
      ORDER BY
        ${SortBy || 'a."invoice date"'} ${Ascending ? 'ASC' : 'DESC'}
`;
  if (adjustedPageSize) {
    query += ` LIMIT
        ${adjustedPageSize}`;
  }
  if (offset) {
    query += `
      OFFSET
        ${offset}`;
  }
  return query;
}

function getCountQuery({ where }) {
  return `
      SELECT COUNT(*) AS totalItems
      FROM datamart.ap_invoices a
      JOIN datamart.shipment_extract b
      ON a."source system" = b."source system"
      AND a."file number" = b."file number"
      ${where}`;
}

async function queryDatabase({ where, SortBy, Ascending, adjustedPageSize, offset }) {
  const redshiftParams = {
    port: process.env.REDSHIFT_PORT,
    user: process.env.REDSHIFT_USER,
    password: process.env.REDSHIFT_PASSWORD,
    database: process.env.REDSHIFT_DATABASE,
    host: 'omni-dw-prod.cnimhrgrtodg.us-east-1.redshift.amazonaws.com',
    // host: process.env.REDSHIFT_HOST,
  };
  let redshiftClient;

  try {
    redshiftClient = new Client(redshiftParams);
    await redshiftClient.connect();
    return await Promise.all([
      await redshiftClient.query(getCountQuery({ where })),
      await redshiftClient.query(
        getMainQuery({ where, SortBy, Ascending, adjustedPageSize, offset })
      ),
    ]);
  } catch (err) {
    console.error(err);
  } finally {
    if (redshiftClient) {
      await redshiftClient.end();
    }
  }
  return [];
}

function getWhereCondition({
  SourceSystem,
  FileNumber,
  StartDate,
  EndDate,
  HouseWayBill,
  MasterBill,
  VendorID,
  InvoiceNumber,
}) {
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
  return whereClause;
}

function getPageSize({ Size }) {
  return parseInt(Size, 10);
}

function getOffset({ Page, Size }) {
  return (parseInt(Page, 10) - 1) * getPageSize({ Size }) ?? 0;
}

module.exports = {
  getKey,
  getAllCombinations,
  decomposeObjects,
  getCountQuery,
  getMainQuery,
  queryDatabase,
  getWhereCondition,
  getPageSize,
  getOffset,
};
