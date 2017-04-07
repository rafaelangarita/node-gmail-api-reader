var endpoint = require('./amqp-endpoint');
var client = require('./server');

endpoint.listen();
client.start();
