var express = require('express');
var fs = require('fs');
var multer = require('multer');
var cookieParser = require('cookie-parser');

var router = express.Router();
router.use(cookieParser());

var DB = require('../public/javascripts/query');
var conne = new DB('localhost', 'root', 'term!ner1', 'aqoom');
if (conne) {
  console.log('connected with DB successfully');
}

var admin = require("firebase-admin");

var serviceAccount = require("/Users/ghobekang/Downloads/aqoomchatbot-firebase-adminsdk-609no-19198ee7d7.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "aqoomchatbot.appspot.com"
});

var bucket = admin.storage().bucket();

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '.' + file.mimetype.split('/')[1])
    }
  })
var upload = new multer({storage: storage});

function delAllFiles(dir) {
    const path = require('path');
    const rpath = path.join(__dirname, dir);
    fs.readdir(rpath, (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
          fs.unlink(path.join(rpath, file), err => {
            if (err) throw err;
          });
        }
      });
}

router.post('/getDefaultInfo', function(req, res, next) {
    const chat_id = req.body.chat_id;
    
    const q = `SELECT 
        chat.type as type,
        chat.title as title,
        chat.created_at as created_at,
        chat.depence_count as depence_count,
        chat.is_active as is_active,
        chat.count_msgs as count_msgs
        FROM 
            chat
        WHERE
            id=${chat_id}`    

    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            res.send(rows[0])
        } else {
            res.send(false)
        }
    })
})

router.post('/checkValidationRoom', function(req, res, next) {
    const dataset = {
        type : 'group',
        title : req.body.title
    }
    const q = `SELECT * FROM chat WHERE type='${dataset.type}' and title='${dataset.title}'`
    
    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            if (rows[0].is_active) {
                res.cookie('living', '1', { expires: new Date(Date.now() + 7200000)}).send({id: rows[0].id})
            } else {
                res.send(false)
            }
        } else {
            res.status(400).send(false)
        }
    });
})

router.post('/checkValidation', function(req, res, next) {
    const dataset = {
        type : 'group',
        title : req.body.title,
        ac_code: req.body.ac_code
    }
    const q = `SELECT * FROM chat WHERE type like '%${dataset.type}%' and title='${dataset.title}' and activation_code='${dataset.ac_code}'`
    
    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            const q = `UPDATE chat SET is_active=1 WHERE activation_code='${dataset.ac_code}'`
            conne.query(q, (result) => {
                res.cookie('living', '1', { expires: new Date(Date.now() + 7200000)}).send({id: rows[0].id})
            })
        } else {
            res.send(false)
        }
    });
})

router.post('/getWordData', function(req, res, next) {
    const q = `SELECT * FROM forb_wordlist where chat_id=${req.body.chat_id}`
    let data = []

    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            for(row of rows) {
                const dataset = {
                    idx : row.idx,
                    name : row.word_name
                }
                data.push(dataset)
            }
            res.send(data)
        } else {
            res.send(false)
        }
    });
})

router.post('/pushWordData', function(req, res, next) {
    if (!req.body.word) {
        res.status(404).send('there is no valid query string. you must involve it to get a query result')
        return false;
    }
    const q = `INSERT INTO forb_wordlist (word_name, chat_id) VALUES ('${req.body.word}', ${req.body.chat_id})`
    conne.query(q, (rows) => {
        if (rows.affectedRows !== 0 && rows.insertId) {
            res.status(200).send(true)
        }
    })
})

router.post('/delWordData', function(req, res, next) {
    if (!req.body.word) {
        res.status(404).send('there is no valid query string. you must involve it to get a query result')
        return false;
    }
    const q = `DELETE FROM forb_wordlist WHERE word_name='${req.body.word}' and chat_id=${req.body.chat_id};`
    conne.query(q, (rows) => {
        if (rows.affectedRows !== 0) {
            res.status(200).send(true)
        } else {
            res.status(400).send('there is any word to be deleted. no action')
        }
    })
})

router.post('/editWordData', function(req, res, next) {
    if (!req.body.ori || !req.body.rep) {
        res.status(404).send('there is no valid query string. you must involve it to get a query result')
        return false;
    }
    const oriWord = req.body.ori;
    const replaceWord = req.body.rep;

    const q = `UPDATE forb_wordlist SET word_name='${replaceWord}' WHERE word_name='${oriWord}' and chat_id=${req.body.chat_id};`
    conne.query(q, (rows) => {
        if (rows.changedRows !== 0) {
            res.status(200).send(true)    
        } else {
            res.status(404).send('there is any word to be replaced. plase check a word again');
            return false;
        }
    })
})

router.post('/getWhitelist', function(req, res, next) {
    const chat_id = req.body.chat_id;
    if (chat_id) {
        const q = `SELECT * FROM whitelist_url WHERE chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.status(200).send(rows)
            } else {
                res.send([])
            }
        })
    }
})

router.post('/pushWhitelist', function(req, res, next) {
    const chat_id = req.body.chat_id;
    const pattern = req.body.pattern;

    if (chat_id) {
        const q = `INSERT INTO whitelist_url (url_pattern, chat_id, created_date) VALUES ('${pattern}', ${chat_id}, now());`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.status(200).send(rows)
            }
        })
    }
})

router.post('/delWhitelist', function(req, res, next) {
    const data = req.body.url;
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `DELETE FROM whitelist_url WHERE url_pattern='${data}' AND chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.status(400).send('there is any word to be deleted. no action')
            }
        })
    }
})

router.post('/getLogs', function(req, res, next) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `SELECT * FROM telegram_deleted_msg_log WHERE chat_id=${chat_id};`
        
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.status(200).send(rows)
            } else {
                res.send([])
            }
        })
    }
})

router.post('/pushFaqlist', upload.array('response_img'), function(req, res, next) {
    const dataset = {
        chat_id : req.body.chat_id,
        response : req.body.response,
        content : req.body.content,
        type : req.body.response_type,
        response_img : req.files.length > 0 ? req.files[0].filename : '',
        image_type : req.body.img_type
    }
    
    if (dataset.response_img) {
        bucket.upload(req.files[0].path)
        .then((file) => {
            dataset['URL'] = "https://storage.googleapis.com/aqoomchatbot.appspot.com/" + file[0].id
            upload_content(dataset)
        })
    } else {
        upload_content(dataset)
    }
     
    function upload_content(dataset) {
        if (dataset.chat_id && dataset.content.length !== 0) {
            const q = `INSERT INTO faq_list 
            (chat_id, faq_content, created_date, update_date, faq_response, faq_response_img, response_type, img_type) 
            VALUES 
            (${dataset.chat_id}, '${dataset.content}', now(), now(), '${dataset.response}', '${dataset.URL}', '${dataset.type}', '${dataset.img_type}')`
    
            conne.query(q, (rows) => {
                if (rows.affectedRows !== 0) {
                    if (dataset.type === 'img') {
                        delAllFiles('../uploads')
                    }
                    res.status(200).send(true)
                } 
            })
        }
    }
})

router.post('/getFaqlist', function(req, res, next) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `SELECT * FROM faq_list WHERE chat_id=${chat_id};`
        
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.status(200).send(rows)
            } else {
                res.send([])
            }
        })
    }
})

router.post('/delFaqlist', function(req, res, next) {
    const data = req.body.content;
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `DELETE FROM faq_list WHERE faq_content='${data}' AND chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.status(400).send('there is any word to be deleted. no action')
            }
        })
    }
})

router.post('/pushStartMenu',  upload.array('content_img'), function(req, res, next) {
    const dataset = {
        chat_id : req.body.chat_id,
        content_txt : req.body.content_text,
        content_img : req.files.length > 0 ? req.files[0].filename : '',
        content_type : req.body.content_type,
        image_type : req.body.img_type
    }
    
    if (dataset.content_img !== '') {
        bucket.upload(req.files[0].path)
        .then((file) => {
            dataset['URL'] = "https://storage.googleapis.com/aqoomchatbot.appspot.com/" + file[0].id
            upload_content(dataset)
        })
    } else {
        upload_content(dataset)
    }

    async function check_validation_for_exists(chat_id, callback) {
        if (chat_id) {
            const q = `SELECT count(*) FROM start_menus WHERE chat_id=${chat_id}`
            
            conne.query(q, (count) => {
                if (count[0]['count(*)'] !== 0) {
                    if (typeof callback === 'function') {
                        return callback(true)
                    }
                } else {
                    if (typeof callback === 'function') {
                        return callback(false)
                    }
                }
            })
        }
    }
    
    function upload_content (dataset) {
        if (dataset.chat_id) {
            check_validation_for_exists(dataset.chat_id, (check_validation) => {
                var q = ''
                if (check_validation) {
                    q = `UPDATE start_menus 
                    SET 
                        content_txt='${dataset.content_txt}', content_img='${dataset.URL}', img_type='${dataset.image_type}', response_type='${dataset.content_type}', update_date=now()
                    WHERE
                        chat_id=${dataset.chat_id};`
                    
                } else {
                    q = `INSERT INTO start_menus 
                    (chat_id, content_txt, content_img, img_type, response_type, created_date, update_date) 
                    VALUES 
                    (${dataset.chat_id}, '${dataset.content_txt}', '${dataset.URL}', '${dataset.image_type}', '${dataset.content_type}', now(), now());`
                }

                conne.query(q, (rows) => {
                    if (rows.affectedRows !== 0) {
                        if (dataset.content_type === 'img') {
                            delAllFiles('../uploads')
                        }
                        
                        res.status(200).send(true)
                    } 
                })
            })

        }
    }

})

router.post('/getStartMenu', function(req, res, next) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `SELECT * FROM start_menus WHERE chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.length > 0) {
                res.status(200).send(rows)
            } else {
                res.status(400)
            }
        })
    }
})

module.exports = router;
