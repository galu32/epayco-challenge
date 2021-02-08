const Promise = require("bluebird");
class Connection {

    constructor(con){
        this.__conn__ = con;
        this._commit_expected_ = 0;
    }

    async beginTransaction(){
        let promise = Promise.pending();
        this.__conn__.rollback();
        this.__conn__.beginTransaction((err) => {
            if (err) {
                this.__conn__.rollback(() => {
                    this.release();
                    promise.reject(err);
                });
            } else {
                promise.resolve(true);
            }
        });
        return promise.promise;
    }

    release(){
        return this.__conn__.release();
    }

    async query(sql,placeholders){
        let promise = Promise.pending();
        try {
            let transaction = await this.beginTransaction();
            if (transaction) {
                this.__conn__.query(sql,placeholders, (err, result) => {
                    if (err) {
                        promise.reject(err);
                    } else {
                        promise.resolve(result);
                    }
                });

            }
        } catch (err) {
            promise.reject(err);
        }
        return promise.promise;
    }

    rollback(){
        let promise = Promise.pending();
        this.__conn__.rollback(() =>{
            this.release();
            promise.resolve(true);
        });
        return promise.promise;
    }

    async commit(){
        let promise = Promise.pending();
        try {
            this.__conn__.commit((err) => {
                if (err) throw err;
                this.release();
                promise.resolve(true);
            });
        } catch (err) {
            await this.rollback();
            promise.reject(err);
        }
        return promise.promise;
    }
}

module.exports = Connection;