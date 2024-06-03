const Redis = require('ioredis');

exports.handler = async (event, context) => {
    try {
        // Specify the nodes of your Redis cluster
        const clusterNodes = [
            { host: 'finance-search-portal-redis-dev-001.finance-search-portal-redis-dev.cbgmpe.use1.cache.amazonaws.com', port: 6379 }
        ];

        // Create a Redis cluster instance
        const cluster = new Redis.Cluster(clusterNodes, {
            scaleReads: 'all', // Optional: allows read operations to be distributed across all nodes
            enableOfflineQueue: false, // Optional: disable offline queue to reduce memory usage
            retryStrategy: times => Math.min(times * 50, 2000) // Optional: exponential backoff retry strategy
        });

        // Example: set a key-value pair
        await cluster.set('test_key', 'test_value');

        // Example: get a value by key
        const value = await cluster.get('test_key');
        console.log('Value retrieved:', value);

        // Remember to close the connection
        cluster.disconnect();

        return {
            statusCode: 200,
            body: 'Successfully connected to Redis cluster'
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: error.message
        };
    }
};
