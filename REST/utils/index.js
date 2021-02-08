let utils = {};

utils.getClientAsync = (end_point) => {
    let soap = require("soap");
    return new Promise((resolve,reject) => {
        soap.createClient(end_point + "?wsdl", function(err, client) {
            if (err) reject(err);
            else resolve(client);
        }, end_point);
    });
};

utils.getAsyncClientCall = (client, method, args) => {
    return new Promise((resolve, reject) => {
        client[method](args, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

utils.stringToBoolean = (str) => str === "true" ? true : false;

utils.SOAPErrorResponseToJSON = (err) => {
    return err.root.Envelope.Body.Fault;
};

utils.randomID = () => Math.floor(Math.random() * 999999);

module.exports = utils;