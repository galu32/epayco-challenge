/* global describe, it, before, after */

global.isTesting = true;

let promise = require("./index");

let {strictEqual} = require("assert");
let {getClientAsync, getAsyncClientCall} = require("./REST/utils");
let {post} = require("axios");

let started = false;
let {API_URLS} = global.configFile;
let {user_service, payment_service} = API_URLS.SOAP;
let {REST} = API_URLS;

//FAKE USER
let user = {
    DocNr: 123,
    Phone: 123,
    Name: "Franco",
    Lastname: "Galuzzi",
    Email: "user@example.com"
};
let Balance = 10000;
let Id = 123123;
//

//DB CLEAN
let db = require("./SOAP/database");
let clean = async(table) => {
    return await db.Query("DELETE FROM " + table);
};
let getToken = async() => {
    return (await db.Query("SELECT Token, Id FROM payment WHERE Used = 0 AND DocNr = " + user.DocNr))[0];
};
//

before((done) => {
    promise.then((res) => {
        started = res;
        done();
    });
});

describe("SERVER test", function(){

    it("Starts server wihtout crashing", () => {
        strictEqual(started, true);
    });

    it("Clean user table", (done) => {
        clean("user").then(response => {
            strictEqual(response.serverStatus, 33);
            done();
        });
    });

    it("Clean payment table", (done) => {
        clean("payment").then(response => {
            strictEqual(response.serverStatus, 33);
            done();
        });
    });

});

describe("SOAP API test", function(){

    let user_client_instance;
    let payment_client_instance;

    let Token;

    it("Creates a client for SOAP API User Service", (done) => {
        getClientAsync(user_service).then(response => {
            user_client_instance = response;
            let res = typeof user_client_instance.describe() === "object";
            strictEqual(res, true);
            done();
        });
    });

    it("Creates a client for SOAP API payment Service", (done) => {
        getClientAsync(payment_service).then(response => {
            payment_client_instance = response;
            let res = typeof payment_client_instance.describe() === "object";
            strictEqual(res, true);
            done();
        });
    });

    it("Creates a user using SOAP API User Service", (done) => {
        getAsyncClientCall(user_client_instance, "RegisterUser", user).then(response => {
            strictEqual(response.response, "User registered");
            done();
        });
    });

    it("Increment a user balance using SOAP API User Service", (done) => {
        let {DocNr, Phone} = user;
        getAsyncClientCall(user_client_instance, "UpdateBalance", {
            DocNr, Phone, Balance,
            Type: "+"
        }).then(response => {
            strictEqual(response.response, "Balance updated correctly.");
            done();
        });
    });

    it("Get user balance using SOAP API User Service", (done) => {
        let {DocNr, Phone} = user;
        getAsyncClientCall(user_client_instance, "GetBalance", {DocNr, Phone}).then(response => {
            strictEqual(response.response, "10000");
            done();
        });
    });

    it("Gen new token using SOAP API payment Service", (done) => {
        let {DocNr} = user;
        getAsyncClientCall(payment_client_instance, "GenToken", {DocNr, Id}).then(response => {
            strictEqual(response.response, "You will receive your Token via E-mail.");
            done();
        });
    });

    it("Validate generated token using SOAP API payment Service", (done) => {
        getToken().then(response => {
            Token = response.Token;
            let {DocNr} = user;
            return {DocNr, Id, Token};
        }).then(response => {
            getAsyncClientCall(payment_client_instance, "ValidToken", response).then(response => {
                strictEqual(response.response, "true");
                done();
            });
        });
    });

    it("Decrease a user balance using SOAP API User Service", (done) => {
        let {DocNr, Phone} = user;
        getAsyncClientCall(user_client_instance, "UpdateBalance", {
            DocNr, Phone, Balance, Token, Id,
            Type: "-"
        }).then(response => {
            strictEqual(response.response, "Balance updated correctly.");
            done();
        });
    });

    it("Get balance after test should be 0", (done) => {
        let {DocNr, Phone} = user;
        getAsyncClientCall(user_client_instance, "GetBalance", {DocNr, Phone}).then(response => {
            strictEqual(response.response, "0");
            done();
        });
    });

});

describe("REST API test", function(){

    it("Increment a user balance using REST API", (done) => {
        let {DocNr, Phone} = user;
        post(`${REST}/IncreaseBalance`, {DocNr,Phone,Balance}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "Balance updated correctly.");
            done();
        });
    });

    it("Get user balance using REST API", (done) => {
        let {DocNr, Phone} = user;
        post(`${REST}/GetBalance`, {DocNr,Phone}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "10000");
            done();
        });
    });

    it("Gen new token using REST API", (done) => {
        let {DocNr} = user;
        post(`${REST}/GenToken`, {DocNr,Id}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "You will receive your Token via E-mail.");
            done();
        });
    });

    it("Decrease a user balance using REST API", (done) => {
        let {DocNr, Phone} = user;
        getToken().then(response => {
            return {DocNr, Id: response.Id, Token: response.Token, Balance, Phone};
        }).then(response => {
            post(`${REST}/DecreaseBalance`, response).then(response =>{
                let {data} = response;
                strictEqual(data.response, "Balance updated correctly.");
                done();
            });
        });
    });

    it("Get balance after test should be 0", (done) => {
        let {DocNr, Phone} = user;
        post(`${REST}/GetBalance`, {DocNr,Phone}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "0");
            done();
        });
    });

});


describe("SOCKET test (REST cache too)", function(){

    let waitForSocket = () => {
        let promise = require("bluebird").pending();
        let io = require("socket.io-client");
        let socket = io.connect("http://localhost:9999", { 
            query: `DocNr=${user.DocNr}`,
            transport : ["websocket"]
        });
        socket.on("connect", () => {
            promise.resolve(socket);
        });
        return promise.promise;
    };

    let {post} = require("axios").create({
        headers: {
            post: {
                "ui-id": "123-123-123"
            },
        }
    });

    let connectedSocket;
    let received_socket_balance;

    it("Connect to socket", (done) => {
        waitForSocket().then(socket => {
            connectedSocket = socket;
            strictEqual(typeof socket === "object", true);
            done();
        });
    });

    it("Register to socket events", () => {
        connectedSocket.on("new_balance", (obj) => {
            received_socket_balance = obj.bal;
        });
    });

    it("Get user balance using REST API (using ui-id header should be cached)", (done) => {
        let {DocNr, Phone} = user;
        post(`${REST}/GetBalance`, {DocNr,Phone}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "0");
            done();
        });
    });

    it("Increment a user balance using REST API (using ui-id header should be cached)", (done) => {
        let {DocNr, Phone} = user;
        post(`${REST}/IncreaseBalance`, {DocNr,Phone,Balance}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "Balance updated correctly.");
            done();
        });
    });

    it("After call increase endpoint received_socket_balance should be 10000", () => {
        let res = received_socket_balance == "10000";
        strictEqual(res, true);
    });

    it("Gen new token using REST API", (done) => {
        let {DocNr} = user;
        post(`${REST}/GenToken`, {DocNr,Id}).then(response =>{
            let {data} = response;
            strictEqual(data.response, "You will receive your Token via E-mail.");
            done();
        });
    });

    it("Decrease a user balance using REST API (using ui-id header should be cached)", (done) => {
        let {DocNr, Phone} = user;
        getToken().then(response => {
            return {DocNr, Id: response.Id, Token: response.Token, Balance, Phone};
        }).then(response => {
            post(`${REST}/DecreaseBalance`, response).then(response =>{
                let {data} = response;
                strictEqual(data.response, "Balance updated correctly.");
                done();
            });
        });
    });

    it("After call decrease endpoint received_socket_balance should be 0", () => {
        let res = received_socket_balance == "0";
        strictEqual(res, true);
    });

});

after(() => process.exit(0));