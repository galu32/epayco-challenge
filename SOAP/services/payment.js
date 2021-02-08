module.exports = async (router) => {
    
    console.log("Initializing SOAP payment Service");

    let soap = require("soap");
    let { v4: uuidv4 } = require("uuid");

    let {argsChecker, wsdlFile, buildErrorResponse, getUser, getExistingToken, genNewToken, isValidToken, sendTokenMail} = require("../utils");

    let fields = [
        {field: "Token", definition: "VARCHAR(255) NOT NULL", required: false, index: true},
        {field: "Id", definition: "VARCHAR(255) NOT NULL", required: true},
        {field: "CreationTime", definition: "VARCHAR(255) NOT NULL", required: false},
        {field: "ExpirationTime", definition: "VARCHAR(255) NOT NULL", required: false},
        {field: "Used", definition: "TINYINT(1) DEFAULT 0", required: false},
        {field: "DocNr", definition: "VARCHAR(255) NOT NULL", required: true},
    ];

    let  db = require("../database");
    await db.createTable("payment", fields);

    soap.listen(router, "/payment", {
        PaymentService: {
            PaymentPort: {
                GenToken: async (args,callback) => {
                    let check = argsChecker(args, fields);
                    if (!check.ok) throw check.response;
                    let {DocNr} = args;
                    try{
                        let res = await getUser({DocNr});
                        if (!res.length)
                            throw buildErrorResponse("User doesn't Exist", `User with DocNr ${args.DocNr} doesn't exist.`);
                        res = await getExistingToken({DocNr});
                        if (res.length)
                            throw buildErrorResponse("Already Exist", `Already Exist a Valid Token for User ${args.DocNr}.`);
                        let Token = uuidv4();
                        res = await genNewToken(args, fields, Token);
                        if (res.affectedRows || res.changedRows){
                            let {Id} = args;
                            if (!global.isTesting) await sendTokenMail({Id, Token, DocNr});
                            callback({response: "You will receive your Token via E-mail."});
                        }
                    } catch (err) {
                        if (typeof err === "string") return {response: err};
                        if (err.Fault) throw err;
                        throw err.toString();
                    }
                },
                ValidToken: async (args, callback) => {
                    let check = argsChecker(args, fields, ["Token"]);
                    if (!check.ok) throw check.response;
                    let {DocNr, Id, Token} = args;
                    try {
                        let res = await isValidToken({DocNr, Id, Token});
                        if (res.length)
                            callback({response: true});
                        else
                            throw buildErrorResponse("Invalid or Expired", `Token ${Token} or Id ${Id} is invalid or expired.`);
                    } catch (err) {
                        if (typeof err === "string") return {response: err};
                        if (err.Fault) throw err;
                        throw err.toString();
                    }
                },
            }
        }
    }, wsdlFile("payment"));

    /*
    <?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soap:Body>
        <xsd1:GenTokenRequest>
            <DocNr>123123</DocNr>
            <Id>111111</Id>
        </xsd1:GenTokenRequest>
    </soap:Body>
    </soap:Envelope>
    */

    /*
    <?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soap:Body>
        <xsd1:ValidTokenRequest>
            <DocNr>123123</DocNr>
            <Id>111111</Id>
            <Token>28914a0d-4235-44bc-9493-1efe72c454f0</Token>
        </xsd1:ValidTokenRequest>
    </soap:Body>
    </soap:Envelope>
    */

};