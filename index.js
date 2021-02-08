let promise = require("bluebird").pending();

(async () => {

    global.configFile = require("./config");

    let {webserver} = global.configFile;

    let express = require("express");
    let app = express();

    let soapRouter = express.Router();
    await require("./SOAP")(soapRouter);
    app.use("/soap", soapRouter);

    let restRouter = express.Router();
    await require("./REST")(restRouter);
    app.use("/rest", restRouter);

    let webRouter = express.Router();
    await require("./WEB")(webRouter, app);
    app.use("/ui", webRouter);

    /*

        //@TODO Aca podria ir un blacklist que bloquee todos los servicios

    */

    app.listen(webserver.port, () => {
        console.log(`Routers manager listening in http://localhost:${webserver.port}`);
        promise.resolve(true);
    });

})();

module.exports = promise.promise;