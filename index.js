let promise = require("bluebird").pending();

(async () => {

    global.configFile = require("./config");

    let express = require("express");
    let app = express();

    let soapRouter = express.Router();
    await require("./SOAP")(soapRouter);
    app.use("/soap", soapRouter);


    /*

        //@TODO Aca podria ir un blacklist que bloquee todos los servicios

    */

    app.listen(3000, () => {
        console.log(`Routers manager listening in http://localhost:${3000}`);
        promise.resolve(true);
    });

})();

module.exports = promise.promise;