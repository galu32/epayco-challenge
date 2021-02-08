module.exports = async (router) => {

    console.log("Initializing REST API");

    let {getClientAsync, getAsyncClientCall, SOAPErrorResponseToJSON, randomID} = require("./utils");
    let {setUser, getUser, updateBalance} = require("./cachemanager");
    let {API_URLS} = global.configFile;
    let {webserver} = global.configFile;

    /*socket
    esto se implementa por el siguiente ejemplo
        si desde la ui se inicia con el mismo DocNr y Phone desde un incognito y un no incognito ambos manejan el mismo cache
        pero.. si desde un navegador se realiza un cambio (por ejemplo un incremento en el saldo) el segundo navegador no reconoce este cambio hasta que se refresque
        de esta manera + la reactividad de Vue si un navegador realiza un cambio, el segundo navegador recibe el evento y actualiza su ui tambien.
    */

    let connected_sockets = [];

    let http = require("http").Server(router);
    let io = require("socket.io")(http, {
        cors: {
            origin: "*",
        }
    });

    io.on("connection", (socket) => {
        connected_sockets = connected_sockets.filter(r => r.socket.connected);
        let r = {DocNr: socket.handshake.query.DocNr, socket, id: socket.id};
        connected_sockets.push(r);
    });

    let broadcast = (event, value, DocNr) => {
        let socks = [...connected_sockets];
        if (DocNr){
            socks = socks.filter(r => r.DocNr == DocNr);
        }
        for (let s of socks) {
            s.socket.emit(event, value);
        }
    };

    http.listen(webserver.socket_port, function() {
        console.log("Socket listening on port " + webserver.socket_port);
    });

    //

    router.use(require("express").json());

    let userSOAPEndpoint = API_URLS.SOAP.user_service;
    let paymentSOAPEndpoint = API_URLS.SOAP.payment_service;

    let getUiId = (req) => req.headers["ui-id"];

    let responseHandler = async (end_point, method, req, res, body) => {
        try{
            let client = await getClientAsync(end_point);
            let call = await getAsyncClientCall(client, method, body || req.body);
            res.status(200).send(call);
            return call;
        } catch (err) {
            let jsonErr = SOAPErrorResponseToJSON(err);
            res.status(200).send(jsonErr);
        }
        return {};
    };

    router.post("/RegisterUser", async (req,res) => {
        await responseHandler(userSOAPEndpoint, "RegisterUser", req, res);
    });

    router.post("/GetBalance", async (req,res) => {
        let {response} = await responseHandler(userSOAPEndpoint, "GetBalance", req, res);
        if (response){
            let id = getUiId(req);
            if (id) {
                setUser(id, {
                    ...req.body,
                    Balance: response
                });
            }
        }
    });

    router.post("/IncreaseBalance", async (req, res) => {
        let payload = {...req.body};
        payload.Type = "+";
        let {response} = await responseHandler(userSOAPEndpoint, "UpdateBalance", req, res, payload);
        if (response){
            let id = getUiId(req);
            if (id) {
                updateBalance(id, payload.Type, payload.Balance);
                let bal = getUser(id).Balance;
                broadcast("new_balance", {emitter: id, bal}, req.body.DocNr);
            }
        }
    });

    router.post("/DecreaseBalance", async (req, res) => {
        let payload = {...req.body};
        payload.Type = "-";
        let {response} = await responseHandler(userSOAPEndpoint, "UpdateBalance", req, res, payload);
        if (response){
            let id = getUiId(req);
            if (id) {
                updateBalance(id, payload.Type, payload.Balance);
                let bal = getUser(id).Balance;
                broadcast("new_balance", {emitter: id, bal}, req.body.DocNr);
            }
        }
    });

    router.post("/GenToken", async (req, res) => {
        let payload = {...req.body, Id: randomID()};
        await responseHandler(paymentSOAPEndpoint, "GenToken", req, res, payload);
    });

    router.get("/check", (req,res) => {
        let id = getUiId(req);
        if (id) {
            let obj = getUser(id);
            if (obj) {
                return res.send({ok: true, obj});
            }
        }
        res.send({ok: false});
    });

};