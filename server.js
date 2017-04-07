var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
const scbNodeParser = require('scb-node-parser');
var Message = require('scb-node-parser').Message;
var mapper = require('./mapper');
var sender = require('./amqp-sender');
var confamqp = require('./conf/amqp-endpoint.conf');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/gmail-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';



//gmail API
var gmail = google.gmail('v1');

function checkEmail(callback) {

    // Load client secrets from a local file.
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Gmail API.
        authorize(JSON.parse(content), function(auth) {
            listMessages(auth, 'me');
        });
    });

    callback();
}
var milliseconds = 5000;

function sleep() {
    setTimeout(function() {
        checkEmail(sleep);
    }, milliseconds);
}

function start() {

    checkEmail(sleep);
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}


/**
 * Retrieve Messages in user's mailbox matching query.
 *
 * @param  {String} userId User's email address. The special value 'me'
 * can be used to indicate the authenticated user.
 * @param  {String} query String used to filter the Messages listed.
 * @param  {Function} callback Function to call when the request is complete.
 */
function listMessages(auth, userId) {
    var emails = gmail.users.messages.list({
        includeSpamTrash: false,
        auth: auth,
        userId: userId,
        q: 'is:unread'
    }, function(err, results) {
        if (err)
            console.log(err);
        else {
            processMessages(auth, userId, results);
        }


    });
}

function processMessages(auth, userId, list) {
    if (list.messages) {
        for (message of list.messages) {
            console.log(message.id);
            gmail.users.messages.get({
                auth: auth,
                userId: userId,
                id: message.id
            }, function(err, results) {
                var body = Buffer.from(results.payload.parts[0].body.data, 'base64');
                console.log('Message: ' + body);
                var parsedMessage = scbNodeParser.getMessage(body);
                console.log('parsedMessage: ' + parsedMessage.getMessage());
                var subject = '';
                var source = '';
                var screenName = '';
                for (header of results.payload.headers) {
                    if (header.name.trim() === 'Subject') {
                        console.log('Subject: ' + header.value);
                        subject = header.value;
                    }
                    if (header.name.trim() === 'From') {
                        console.log('From: ' + header.value);
                        source = header.value.toString().match(/\<(.*?)\>/)[1];
                        var data = header.value;
                        //remove the email and trim and
                        //line breaks from the start and the end
                        screenName = data.replace(header.value.toString().match(/\<(.*?)\>/)[0], '')
                            .trim()
                            .replace(/^\s+|\s+$/g, '');

                        console.log('source: ' + source);
                    }
                }
                setToRead(auth, userId, results.id);

                console.log('Map: ' + mapper.map(subject, parsedMessage.getMessage()));
                parsedMessage.setFrom({
                    name: screenName,
                    uniqueName: source
                });
                parsedMessage.setSubject(subject);
                parsedMessage.setMessage(parsedMessage.getMessage());
                parsedMessage._persona = confamqp.exchange.name;
                sender.post(parsedMessage);
            });
        }
    } else {
        console.log('No new messages')
    }
}

function setToRead(auth, userId, messageId) {
    //set to 'READ'
    var request = gmail.users.messages.modify({
        auth: auth,
        userId: userId,
        id: messageId,
        resource: {
            addLabelIds: [],
            removeLabelIds: ['UNREAD']
        }
    }, function(err, results) {
        if (err)
            console.log(err);
        else {
            console.log(results.id + ' set to READ');
        }
    });
}

exports.start = start;
