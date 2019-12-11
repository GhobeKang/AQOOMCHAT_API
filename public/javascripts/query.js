var mysql = require('mysql')

class DB_query {
    constructor(host, user, pswd, db) {
        const connection = mysql.createConnection({
            host: host,
            user: user,
            password: pswd,
            database: db
          })
        this.connection = connection;
        
        this.connection.connect(function(err) {
            if (err) {
                console.error('error connecting: ' + err.stack + err.sqlMessage +err.message);
            }
            return false;
        })

        return true;
    }

    query (querystr, callback) {
        this.connection.query( querystr , function (err, rows, fields) {
            if (err) throw err

            if (typeof callback === 'function') {
                callback(rows)
            }
        })
    }

    disconnection () {
        this.connection.end();
        this.connection.destroy();
        return true;
    }
}

module.exports = DB_query;