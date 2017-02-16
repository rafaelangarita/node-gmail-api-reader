function Message(source, destination, data) {
    this._source = source;
    this._destination = destination;
    this._data = data;
}

Message.prototype = {
    getSource: function() {
        return this._source;
    },

    getDestination: function() {
        return this._destination;
    },


    getData: function() {
        return this._data;
    }
};

module.exports = Message;
