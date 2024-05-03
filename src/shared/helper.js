'use strict';

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

module.exports = { getKey, getAllCombinations, decomposeObjects };
