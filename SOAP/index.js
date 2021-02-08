module.exports = async (router) => {

    console.log("Initializing SOAP manager");

    let db = require("./database");
    await db.init();

    await require("./services/user")(router);
    await require("./services/payment")(router);

    /*

        Auth Middleware?????????

    */

};