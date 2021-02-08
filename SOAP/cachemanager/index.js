/*
    Para que esta integración tenga mas sentido lo ideal seria usar redis / memc pero no estoy seguro si quien va
    a realizar las pruebas tiene/puede instalado/instalar.
*/

let LRUCache = require("lru-cache");

let cacheManager = new LRUCache({
    max: 100,
    maxAge: 1000 * 60 * 60 // 1hour
});

let setUser = (DocNr, obj) => {
    cacheManager.set(`USER::${DocNr}`, obj);
};

let getUser = (DocNr) => {
    return cacheManager.get(`USER::${DocNr}`);
};

let updateBalance = (DocNr, operation, balance) => {
    let obj = getUser(DocNr);
    if (obj) {
        if (operation === "+")
            obj.Balance = parseFloat(obj.Balance) + parseFloat(balance);
        if (operation === "-")
            obj.Balance = parseFloat(obj.Balance) - parseFloat(balance);
        setUser(DocNr, obj);
    }
};

module.exports = {
    setUser,
    getUser,
    updateBalance
};