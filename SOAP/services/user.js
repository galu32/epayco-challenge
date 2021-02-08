module.exports = async (router) => {
    
    console.log("Initializing SOAP user Service");

    let soap = require("soap");
    let  db = require("../database");

    let {argsChecker, wsdlFile, genUser, buildErrorResponse, useToken,
        updateUser, getUser, isValidToken} = require("../utils");

    let fields = [
        {field: "DocNr", definition: "INT(15) NOT NULL", required: true, index: true},
        {field: "Phone", definition: "INT(15) NOT NULL", required: true},
        {field: "Email", definition: "VARCHAR(255) NOT NULL", required: true},
        {field: "Lastname", definition: "VARCHAR(255) NOT NULL", required: true},
        {field: "Name", definition: "VARCHAR(255) NOT NULL", required: true},
        {field: "Balance", definition: "DOUBLE NOT NULL", required: false}
    ];

    await db.createTable("user", fields);

    soap.listen(router, "/user", {
        UserService: {
            UserPort: {
                RegisterUser: async (args, callback) => {
                    let check = argsChecker(args, fields);
                    if (!check.ok) throw check.response;
                    try {
                        let res = await genUser(args, fields);
                        if (res.affectedRows || res.changedRows)
                            callback({response: "User registered"});
                    } catch (err) {
                        let error = db.handleMysqlError(err);
                        if (error === "ER_DUP_ENTRY")
                            throw buildErrorResponse("Already Exist", `User with DocNr ${args.DocNr} already exist.`);
                    }
                },
                UpdateBalance: async (args, callback) => {
                    let filteredFields = [...[{field: "Type", definition: "VARCHAR"}] , ...fields.filter(r => ["Phone", "DocNr", "Balance"].includes(r.field))];
                    let check = argsChecker(args, filteredFields, ["Balance", "Type"]);
                    if (!check.ok) throw check.response;
                    let {DocNr, Phone} = args;
                    try {
                        let res = await getUser({DocNr, Phone});
                        if (!res.length)
                            throw buildErrorResponse("User doesn't Exist", `User with DocNr ${args.DocNr} and Phone ${args.Phone} doesn't exist.`);
                        else {
                            let user = {...res[0]};
                            if (args.Type === "+")
                                user.Balance = parseFloat(user.Balance) + parseFloat(args.Balance);
                            else if (args.Type === "-"){
                                let {Token, Id} = args;
                                if (!Token) throw buildErrorResponse("Missing Token", "In decrement operations Token is needed.");
                                if (!Id) throw buildErrorResponse("Missing Id", "In decrement operations Id is needed.");
                                user.Balance = parseFloat(user.Balance) - parseFloat(args.Balance);
                                if (user.Balance < 0)
                                    throw buildErrorResponse("Insufficent Balance", `User doesn't have enough balance, current balance: ${res[0].Balance}`);
                                res = await isValidToken({DocNr, Id, Token});
                                if (!res.length)
                                    throw buildErrorResponse("Invalid or Expired", `Token ${Token} or Id ${Id} is invalid or expired.`);
                                else
                                    await useToken(Token);
                            }
                            else
                                throw buildErrorResponse("Operation Type Incorrect", "Type field should be '+' or '-'");
                            res = await updateUser({DocNr, Phone}, user);
                            if (res.affectedRows || res.changedRows) {
                                callback({response: "Balance updated correctly."});
                            } else
                                throw res;
                        }
                    } catch (err) {
                        if (typeof err === "string") return {response: err};
                        if (err.Fault) throw err;
                        throw err.toString();
                    }
                },
                GetBalance: async(args, callback) => {
                    let filteredFields = fields.filter(r => ["Phone", "DocNr"].includes(r.field));
                    let check = argsChecker(args, filteredFields);
                    if (!check.ok) throw check.response;
                    let {DocNr, Phone} = args;
                    try {
                        let res = await getUser({DocNr, Phone});
                        if (!res.length)
                            throw buildErrorResponse("User doesn't Exist", `User with DocNr ${args.DocNr} and Phone ${args.Phone} doesn't exist.`);
                        else {
                            callback({response: res[0].Balance});
                        }
                    } catch (err) {
                        if (typeof err === "string") return {response: err};
                        if (err.Fault) throw err;
                        throw err.toString();
                    }
                }
            }
        }
    }, wsdlFile("user"));

    /*
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
            xmlns:tns="http://example.com/user.wsdl"
            xmlns:xsd1="http://example.com/user.xsd"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <soap:Body>
                <xsd1:UserRequest>
                    <DocNr>123</DocNr>
                    <Phone>123</Phone>
                    <Name>Franco</Name>
                    <Lastname>Galuzzi</Lastname>
                    <Email>f.galuzzi@gmail.com</Email>
                </xsd1:UserRequest>
            </soap:Body>
        </soap:Envelope>
    */

    /*
    <?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soap:Body>
        <xsd1:UpdateBalanceRequest>
            <DocNr>123</DocNr>
            <Phone>123</Phone>
            <Token>a1ce3af1-340b-4e78-ae26-38b4a01af276</Token>
            <Id>1111</Id>
            <Balance>1</Balance>
            <Type>-</Type>
        </xsd1:UpdateBalanceRequest>
    </soap:Body>
    </soap:Envelope>
    */

    /*
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <soap:Body>
            <xsd1:GetBalanceRequest>
                <DocNr>123</DocNr>
                <Phone>123</Phone>
                <Balance>1000</Balance>
            </xsd1:GetBalanceRequest>
        </soap:Body>
        </soap:Envelope>
    */

};