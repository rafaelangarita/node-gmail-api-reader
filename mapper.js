function map(subject, message) {

    var m = 'Subject: ' + subject + '\n';
    m += 'Message: ' + message;

    return m;
}

module.exports.map = map;
