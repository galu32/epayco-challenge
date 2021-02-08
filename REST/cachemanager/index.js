/*
    Para que esta integración tenga mas sentido lo ideal seria usar redis / memc pero no estoy seguro si quien va
    a realizar las pruebas tiene/puede instalado/instalar.
*/

let LRUCache = require("lru-cache");

let cacheManager = new LRUCache({
    max: 100,
    maxAge: 1000 * 60 * 60 // 1hour
});

let setUser = (id, obj) => {
    cacheManager.set(`USER::${id}`, obj);
    if (obj.DocNr)
        cacheManager.set(`DOCNR::${obj.DocNr}`, obj);
};

let getUser = (id) => {
    let obj = cacheManager.get(`USER::${id}`);
    if (obj && obj.DocNr) {
        return cacheManager.get(`DOCNR::${obj.DocNr}`);
    } else return obj;
};

let updateBalance = (id, operation, balance) => {
    let obj = getUser(id);
    if (obj) {
        if (operation === "+")
            obj.Balance = parseFloat(obj.Balance) + parseFloat(balance);
        if (operation === "-")
            obj.Balance = parseFloat(obj.Balance) - parseFloat(balance);
        setUser(id, obj);
    }
};

module.exports = {
    setUser,
    getUser,
    updateBalance,
};