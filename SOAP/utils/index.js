let moment = require("moment");
let  db = require("../database");
let _ = require("lodash");

let {getUser, setUser} = require("../cachemanager");

let {mailing} = global.configFile;

let nodemailer = require("nodemailer");
let transporter = nodemailer.createTransport({
    service : mailing.service,
    auth :{
        user : mailing.user,
        pass : mailing.pass
    }
});

let utils = {};

utils.buildErrorResponse = (code, reason, status) => {
    return {
        Fault: {
            Code: {
                Value: code,
            },
            Reason: { Text: reason },
            statusCode: status || 500
        }
    };
};

utils.argsChecker = (args, fields, requireds = []) => {

    let requiredArgs = fields
        .filter(r => r.required || requireds.includes(r.field))
        .map(r => r.field);

    for (let arg of requiredArgs){
        if (!args[arg])
            return {
                ok: false,
                response: utils.buildErrorResponse("Missing Arg", `Missing request argument ${arg}`)
            };
        let correctType = false;
        let f = fields.find(r => r.field === arg);
        if (f.definition.includes("VARCHAR"))
            correctType = _.isString(args[arg]);
        if (f.definition.includes("DOUBLE") || f.definition.includes("TINYINT") || f.definition.includes("INT"))
            correctType =  isFinite(args[arg]);
        if (!correctType){
            return {
                ok: false,
                response: utils.buildErrorResponse("Incorrect Arg Type", `${arg} has a incorrect type`)
            };
        }
    }
    return {ok: true};

};

utils.wsdlFile = (service) => {
    let dn = __dirname.replace("utils", "wsdl");
    return require("fs").readFileSync(`${dn}/${service}.wsdl`, "utf8");
};

utils.stringifyJSONToMysql = (obj) => {

    let str = "";
    for (let [inx,row] of obj.entries()){
        str += `${row.field} ${row.definition} ${inx !== obj.length -1 ? ", \n" : ""}`;
    }
    return str;

};

utils.insertBuilder = (table, payload, extras, fields) => {
    let fieldsN = fields.map(r => r.field);
    let payloadFiltered = {};
    for (let f of fieldsN){
        if (typeof extras[f] !== "undefined"){
            payloadFiltered[f] = extras[f];
            continue;
        }
        payloadFiltered[f] = payload[f];
    }
    return {sql: `INSERT INTO ${table} SET ?`, placeholder: payloadFiltered};
};

utils.formatMysqlClause = (k, val, stringMode) => {
    let operator = "=";
    if (k.includes("__greater")){
        k = k.replace("__greater", "");
        operator = ">";
    }
    //@TODO OJO CON LOS FIELD TYPE ACA, PASAR A CLASES CADA MODEL DE MYSQL PARA MEJORAR ESTO
    /*
        que es lo que pasa: 
        como el query es un stringMode y no un placeholder mysql lo toma como un campo
        solo se da en el caso del update Used = 1 que hace el decrement del balance
        UPDATE payment SET ? WHERE  Token = 28914a0d-4235-44bc-9493-1efe72c454f0
        con la linea de abajo se soluciona para este campo, no es universal.
    */
    if (k === "Token") val = `"${val}"`;
    return ` ${k} ${operator} ${stringMode ? val : "?"} `;
};

utils.whereClauseBuilder = (clause, stringMode = false) => {
    let sql = "WHERE ";
    let keys = Object.keys(clause);
    let placeholder = [];
    for (let [inx,k] of keys.entries()){
        // let s = ` ${k} = ${stringMode ? clause[k] : "?"} `;
        let s = utils.formatMysqlClause(k, clause[k], stringMode);
        if (inx !== keys.length - 1) s += "AND ";
        sql += s;
        if (!stringMode) placeholder.push(clause[k]);
    }
    return {sql,placeholder};
};

utils.selectBuilder = (table, fields, clause) => {
    let s = `SELECT ${Array.isArray(fields) ? fields.toString() : fields} FROM ${table} `;
    let p = [];
    if (Object.keys(clause).length) {
        let {sql,placeholder} = utils.whereClauseBuilder(clause);
        s += sql;
        p = placeholder;
    }
    return {sql: s, placeholder: p};
};

utils.updateBuilder = (table, clause, set) => {
    let whereString = utils.whereClauseBuilder(clause,true).sql;
    let sql = `UPDATE ${table} SET ? ${whereString}`;
    return {sql, placeholder: set};
};

utils.formatDateToMysql = (date) => {
    if (!(date instanceof require("moment")))
        return null;
    return date.format("YYYY-MM-DD HH:mm:ss");
};

utils.stringToBoolean = (str) => str === "true" ? true : false;

utils.getExistingToken = async(clause, fields = "*") => {
    if (Array.isArray(fields)) fields = fields.toString();
    let {sql, placeholder} = utils.selectBuilder("payment", [fields], {
        ...clause,
        Used: 0,
        "DATE_FORMAT(ExpirationTime, '%Y-%m-%d %H:%i:%s')__greater": utils.formatDateToMysql(moment())
    });
    return await db.Query(sql,placeholder);
};

utils.genNewToken = async(args, fields, Token) => {
    let CreationTime = moment();
    let tokenExtras = {
        Token,
        CreationTime: utils.formatDateToMysql(CreationTime),
        ExpirationTime: utils.formatDateToMysql(CreationTime.add(1, "hour")),
        Used: 0,
    };
    let {sql, placeholder} = utils.insertBuilder("payment", args, tokenExtras, fields);
    return await db.Query(sql,placeholder);
    
};

utils.isValidToken = async(clause) => {
    return await utils.getExistingToken(clause);
};

utils.useToken = async(Token) => {
    let {sql, placeholder} = utils.updateBuilder("payment", {Token}, {Used: 1});
    return await db.Query(sql,placeholder);
};

utils.sendTokenMail = async({Token, Id, DocNr}) => {
    let res = await utils.getUser({DocNr});
    if (!res.length)
        throw utils.buildErrorResponse("User doesn't Exist", `User with DocNr ${DocNr} doesn't exist.`);
    await transporter.sendMail({
        from: mailing.user,
        to: res[0].Email,
        subject: "Your Token is here",
        html: `
                <div style='text-align:center'>
                    <p>Dear ${DocNr}</p>
                    <p>Your Token is ${Token} generated by SOAP</p>
                    <p>Your Transaction Id is ${Id}</p>
                </div>
            `
    });
}; 

utils.getUser = async(clause, fields = "*") => {
    if (Array.isArray(fields)) fields = fields.toString();
    if (clause.DocNr) {
        let obj = getUser(clause.DocNr);
        if (obj) return [obj];
    }
    let {sql, placeholder} = utils.selectBuilder("user", fields, clause);
    return await db.Query(sql,placeholder);
};

utils.genUser = async(args, fields, extras = {}) => {
    extras = {Balance:0, ...extras};
    if (args.DocNr){
        setUser(args.DocNr, {...args, ...extras});
    }
    let {sql, placeholder} = utils.insertBuilder("user", args, extras, fields);
    return await db.Query(sql,placeholder);
};

utils.updateUser = async(clause, object) => {
    if (clause.DocNr) {
        setUser(clause.DocNr, object);
    }
    let {sql, placeholder} = utils.updateBuilder("user", clause, object);
    return await db.Query(sql,placeholder);
};

module.exports = utils;