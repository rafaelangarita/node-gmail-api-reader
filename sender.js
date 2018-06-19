#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');




const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'credentials.json';

/**
 * @file
 * Binding Component implementation automatically generated by
 * the Social Communication Platform.
 *
 * Characteristics:
 * - Type: SMTP sender.
 */

var mailer = require('./lib/mailer');
var Message = require('scb-node-parser/message');

/**
 * Sends a message a SMTP server.
 * Protocol: SMTP.
 * @param {string} msg - The message to send.
 */
/*exports.post = function(msg) {
    //msg = JSON.parse(msg);
    console.log('send email %s ' + JSON.stringify(msg));
    console.log('to 1 %s ' + msg._to);
    console.log('to 2 %s ' + msg._to.uniqueName);
    opts = {
        from: msg.getFrom(),
        to: msg._to.uniqueName,
        subject: 'From: ' + msg.getFrom().uniqueName + '. ' + msg.getSubject(),
        body: msg.getMessage()
    }
    console.log('opts %s ', JSON.stringify(opts));
    mailer.sendMail(opts);
};*/
 let msg;
exports.post = function(msgp) {
    msg = msgp;
     // Load client secrets from a local file.
     fs.readFile('client_secret.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Sheets API.
        authorize(JSON.parse(content), sendMessage);
    });
};


function makeBody(to, from, subject, message) {
    var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
        "MIME-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        "to: ", to, "\n",
        "from: ", from, "\n",
        "subject: ", subject, "\n\n",
        message
    ].join('');

    var encodedMail = new Buffer(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
        return encodedMail;
}

function sendMessage(auth) {
    console.log('sender.js sending message ' + JSON.stringify(msg));
    const gmail = google.gmail({version: 'v1', auth});
    var raw = makeBody(msg._to.uniqueName, msg.getFrom(), 'From: ' + msg.getFrom().name + '. ' + msg.getSubject(),  msg.getMessage());
    gmail.users.messages.send({
        auth: auth,
        userId: 'me',
        resource: {
            raw: raw
        }
    }, function(err, response) {
        res.send(err || response)
    });
}


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