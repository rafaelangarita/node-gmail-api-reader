const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const scbNodeParser = require('scb-node-parser');
var Message = require('scb-node-parser').Message;
var mapper = require('./mapper');
var sender = require('./amqp-sender');
var confamqp = require('./conf/amqp-endpoint.conf');

var replyParser = require("node-email-reply-parser");


// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'credentials.json';


var milliseconds = 1000;

function sleep() {
    setTimeout(function() {
        checkEmail(sleep);
    }, milliseconds);
}


function start() {

    checkEmail(sleep);
    
}


function checkEmail(callback) {
    // Load client secrets from a local file.
    fs.readFile('client_secret.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Sheets API.
        authorize(JSON.parse(content), listMessages);
    });

    callback();
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.labels.list({
    userId: 'me',
  }, (err, {data}) => {
    if (err) return console.log('The API returned an error: ' + err);
    const labels = data.labels;
    if (labels.length) {
      console.log('Labels:');
      labels.forEach((label) => {
        console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  });
}

/* Retrieve Messages in user's mailbox matching query.
*
* @param  {String} userId User's email address. The special value 'me'
* can be used to indicate the authenticated user.
* @param  {String} query String used to filter the Messages listed.
* @param  {Function} callback Function to call when the request is complete.
*/
function listMessages(auth) {
   const gmail = google.gmail({version: 'v1', auth});
   var userId = 'me';
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
    var gmail = google.gmail({
        version: 'v1',
        auth
    });
        if (list.data.messages) {
            for (message of list.data.messages) {
                console.log(message.id);
                gmail.users.messages.get({
                    userId: userId,
                    id: message.id
                }, function(err, results) {
                    //console.log(results.data);
                    var body = Buffer.from(results.data.payload.parts[0].body.data, 'base64');
                    console.log('Message: ' + body);
                    var parsedMessage = scbNodeParser.getMessage(body);
                    console.log('parsedMessage: ' + parsedMessage.getMessage());
                    var subject = '';
                    var source = '';
                    var screenName = '';
                    for (header of results.data.payload.headers) {
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
                    console.log("to set read " + results.data.id);
                    setToRead(auth, userId, results.data.id);
    
                    console.log('Map: ' + mapper.map(subject, parsedMessage.getMessage()));
                    parsedMessage._from = {
                        name: screenName,
                        uniqueName: source
                    };
                    parsedMessage._to = {
                        name: screenName,
                        uniqueName: source
                    };
                    /**
                     * The next lines are not necessary in a production version of socialbus,
                     * since every socialbus user will have its own email address;
                     * for example, rafael.angarita@socialbus.io, nikolaos.georgantes@socialbus.io,...
                     * 
                     * In this demo version, messages sent to emails users have the following subject:
                     * 
                     *  Subject:  Conversation with senderSocialbusUserId
                     *  
                     *  however, they all have the same email.
                     * 
                     *  The send a reply to the right user, we extract senderSocialbusUserId
                     *  from the subject.
                     */

                    var Y = "Conversation with";
                    var to = subject.slice(subject.indexOf(Y) + Y.length).trim();
                    parsedMessage._to = [
                        //'rafaelangarita.at.bus@gmail.com'
                        to
                    ];
                    parsedMessage.setSubject(subject);
                    var visibleText = replyParser(parsedMessage.getMessage(), true);
                    parsedMessage.setMessage(visibleText);
                    parsedMessage._type = 'TO';
                    parsedMessage._persona = confamqp.exchange.name;
                    
                    sender.post(parsedMessage);
                });
            }
        } else {
            console.log('No new messages')
        }
    }
    
    function setToRead(auth, userId, messageId) {
    var gmail = google.gmail({
        version: 'v1',
        auth
    });
        console.log('setting to read');
        //set to 'READ'
        var request = gmail.users.messages.modify({
            userId: userId,
            id: messageId,
            resource : {
            addLabelIds: [],
            removeLabelIds: ['UNREAD']}
        }, function(err, results) {
            if (err)
                console.log(err);
            else {
                console.log(messageId + ' set to READ');
            }
        });
    }


exports.start = start;