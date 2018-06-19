var endpoint = require('./amqp-endpoint');
var client = require('./quickstart');

endpoint.listen();
client.start();
