var mysql = require('mysql')

class DB_query {
    constructor(host, user, pswd, db) {
        const db_config = {
            user: user,
            password: pswd,
            database: db,
            // socketPath: `/cloudsql/${host}`,
            host: host,
            multipleStatements: true,
            charset: 'utf8mb4'
          }
        
        this.connection = mysql.createPool(db_config);

        // function handleDisconnect() {
        //     this.connection = mysql.createConnection(db_config); // Recreate the connection, since
        //                                                     // the old one cannot be reused.
          
        //     this.connection.connect(function(err) {              // The server is either down
        //       if(err) {                                     // or restarting (takes a while sometimes).
        //         console.log('error when connecting to db:', err);
        //         setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        //       }                                     // to avoid a hot loop, and to allow our node script to
        //     });                                     // process asynchronous requests in the meantime.
        //                                             // If you're also serving http, display a 503 error.
        //     this.connection.on('error', (err) => {
        //       console.log('db error', err);
        //       if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
        //         handleDisconnect.call(this);                         // lost due to either server restart, or a
        //       } else {                                      // connnection idle timeout (the wait_timeout
        //         throw err;                                  // server variable configures this)
        //       }
        //     });
        //   }

        //   handleDisconnect.call(this);
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