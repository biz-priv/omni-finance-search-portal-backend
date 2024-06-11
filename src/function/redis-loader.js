'use strict';
const { get } = require('lodash');
const {
  queryDatabase,
  getAllCombinations,
  getWhereCondition,
  getPageSize,
  getOffset,
} = require('../shared/helper');
const moment = require('moment-timezone');

exports.handler = async () => {
  const SourceSystem = [
    { SourceSystem: 'MH' },
    { SourceSystem: 'EE' },
    { SourceSystem: 'WT' },
    { SourceSystem: 'CW' },
    { SourceSystem: 'TR' },
    { SourceSystem: 'TI' },
    { SourceSystem: 'LL' },
    { SourceSystem: 'M1' },
    { SourceSystem: 'AG' },
  ];

  const Timeline = [
    {
      StartDate: moment().subtract(1, 'M').format(),
      EndDate: moment().format(),
    },
    {
      StartDate: moment().subtract(3, 'M').format(),
      EndDate: moment().format(),
    },
    {
      StartDate: moment().subtract(6, 'M').format(),
      EndDate: moment().format(),
    },
    {
      StartDate: moment().subtract(1, 'year').format(),
      EndDate: moment().format(),
    },
    {
      StartDate: moment().subtract(1, 'year').format(),
      EndDate: moment().subtract(1, 'year').format(),
    },
  ];

  const SortBy = [
    { SortBy: 'file_date' },
    { SortBy: 'invoice_date' },
    { SortBy: 'vendor_complete_date' },
    { SortBy: 'invoice_date' },
    { SortBy: 'finalized_date' },
  ];
  const isAscending = [{ Ascending: true }, { Ascending: false }];
  const RowPerPage = [{ Size: 10 }, { Size: 20 }, { Size: 30 }];
  const Page = [{ Page: 1 }, { Page: 2 }];

  const response = getAllCombinations([
    SourceSystem,
    Timeline,
    SortBy,
    isAscending,
    RowPerPage,
    Page,
  ]);
  // console.info('🙂 -> file: redis-loader.js:46 -> exports.handler= -> response:', JSON.stringify(response));

  const wheres = response.slice(0, 10).map((param) => {
    // console.info('🙂 -> file: redis-loader.js:49 -> wheres -> param:', Object.assign({}, ...param));
    const where = getWhereCondition(Object.assign({}, ...param));
    return {
      where,
      Size: get(Object.assign({}, ...param), 'Size'),
      Page: get(Object.assign({}, ...param), 'Page'),
    };
    // return param
  });
  console.info(
    '🙂 -> file: redis-loader.js:49 -> exports.handler= -> wheres:',
    JSON.stringify(wheres)
  );

  // const res = await queryDatabase({ where:  })
  const res = await Promise.all(
    wheres.map(async (item) => {
      const adjustedPageSize = getPageSize({ Size: get(item, 'Size') });
      const offset = getOffset({ Page: get(item, 'Page'), Size: get(item, 'Size') });
      return await queryDatabase({ where: get(item, 'where'), adjustedPageSize, offset });
    })
  );
  console.info('🙂 -> file: redis-loader.js:63 -> res -> res:', JSON.stringify(res));
};
