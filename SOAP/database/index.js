const mysql = require("mysql");
const Promise = require("bluebird");
const Connection = require("./connection");

let db = {};

let {database} = global.configFile;

db.init = async () => {

    console.log("Initializing SOAP DB Pool");

    db.pool = mysql.createPool({
        connectionLimit: 10,
        acquireTimeout: 10000,
        timeout: 10000,
        dateStrings: true,
        port: database.port,
        host: database.host,
        user: database.user,
        password: database.pass,
        database: global.isTesting ? database.test_db : database.db
    });

    db.pool.on("connection", (connection) => {
        connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        connection.query("SET SESSION AUTOCOMMIT=0;");
        connection.query("set SESSION sql_mode=''");
        connection.query("set SESSION net_read_timeout=120");
    });

};

db.getConnection = () => {
    let promise = Promise.pending();
    db.pool.getConnection((err, connection) => {
        let res = new Connection(connection);
        promise.resolve(res);
    });
    return promise.promise;
};

db.Query = async (sql, placeholders, commit) => {
    let con = await db.getConnection();
    try {
        let commit_expected = sql.toUpperCase().startsWith("DELETE") || sql.toUpperCase().startsWith("INSERT") || sql.toUpperCase().startsWith("UPDATE");
        let res = await con.query(sql,placeholders);
        if (commit_expected || commit) {
            await con.commit();
        } else con.release();
        return res;
    } catch (err) {
        await con.rollback();
        throw err;
    }
};

db.createTable = async(table, fields) => {
    let {stringifyJSONToMysql} = require("../utils");
    let indexFields = fields.filter(r => r.index).map(r => r.field);
    console.log("Trying to sync Mysql table " + table);
    let str = `
        CREATE TABLE IF NOT EXISTS ${table} (
            internalId INT AUTO_INCREMENT PRIMARY KEY,
            ${stringifyJSONToMysql(fields)}
            ${indexFields.length ? `, UNIQUE KEY(${indexFields.toString()})` : ""}
        )  ENGINE=INNODB;
    `;
    await db.Query(str);
};

db.handleMysqlError = (err) => {
    return err.code;
};

module.exports = db;