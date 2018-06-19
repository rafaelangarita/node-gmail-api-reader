var nodemailer = require('nodemailer'),
    config = require('./mailer.conf');

exports.sendMail = function(opts) {
    var smtpTransport;

    console.log('Creating Transport');

    //smtp transport configuration
    var smtpTransport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        auth: {
            user: config.email,
            pass: config.password
        }
    });

    //Message
    var message = {
        from: opts.from,
        replyTo: opts.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.body
    };

    console.log('Sending Mail');
    // Send mail
    smtpTransport.sendMail(message, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Message sent successfully!');
            console.log('Server responded with "%s"', info.response);
        }
        console.log('Closing Transport');
        smtpTransport.close();
    });

}
