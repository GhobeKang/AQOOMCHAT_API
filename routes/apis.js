var express = require('express');
var fs = require('fs');
var crypto = require('crypto');
var multer = require('multer');
var MulterGCS = require('multer-google-storage');
const {format} = require('util');
var cookieParser = require('cookie-parser');

var router = express.Router();
router.use(cookieParser());

var DB = require('../public/javascripts/query');

var develop_env = 0;

if (develop_env) {
    var conne = new DB('localhost', 'root', 'term!ner1', 'aqoom');
} else {
    var conne = new DB('chatbot-258301:asia-northeast2:aqoomchat', 'root', 'aq@@mServ!ce', 'aqoomchat');
}

if (conne) {
  console.log('connected with DB successfully');
}

var admin = require("firebase-admin");

var serviceAccount = require("../chatbot-258301-c2fa645f32de.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "chatbot-258301.appspot.com"
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
var upload = new multer({storage: multer.memoryStorage()});

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
        chat.id as chat_id,
        chat.type as type,
        chat.title as title,
        chat.created_at as created_at,
        chat.depence_count as depence_count,
        chat.is_active as is_active,
        chat.count_msgs as count_msgs
        FROM 
            aqoomchat.chat
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
            const crypto_ = crypto.createHash('sha1')
            crypto_.update(Date.now().toString());
            
            const q = `UPDATE chat SET is_active=1, activation_code='${crypto_.digest('hex')}' WHERE activation_code='${dataset.ac_code}'`
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

    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            res.send(rows)
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
    const q = `INSERT INTO forb_wordlist (word_name, chat_id, created_time, is_active) VALUES ('${req.body.word}', ${req.body.chat_id}, now(), 1)`
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
    const type = req.body.type;
    const id = req.body.id;
    const is_active = req.body.content;
    
    let q = '';

    if (type === 'status') {
        q = `UPDATE forb_wordlist SET is_active='${is_active}' WHERE idx=${id} and chat_id=${req.body.chat_id};`
    } 
    
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
        const q = `INSERT INTO whitelist_url (id, url_pattern, chat_id, created_date) VALUES (${Math.floor((Math.random() * 10000) + 1)}, '${pattern}', ${chat_id}, now());`

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

router.post('/updateWhitelist', function(req, res) {
    const chat_id = req.body.chat_id;
    const type = req.body.type;
    const data = req.body.content;
    const list_id = req.body.id;
    let q = '';

    if (type === 'status') {
        q = `UPDATE whitelist_url SET is_active=${data} WHERE chat_id=${chat_id} and id=${list_id};`    
    } else if (type === 'content') {
        q = `UPDATE whitelist_url SET url_pattern=${data} WHERE chat_id=${chat_id} and id=${list_id};`
    }

    conne.query(q, (rows) => {
        if (rows.affectedRows !== 0) {
            res.status(200).send(true)
        } 
    })
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
        image_type : req.body.img_type,
        id: Math.floor((Math.random() * 100000) + 1)
    }
    
    if (dataset.response_img !== '') {
        // Create a new blob in the bucket and upload the file data.
        const blob = bucket.file(req.files[0].originalname);
        const blobStream = blob.createWriteStream({
            resumable: false,
        });

        blobStream.on('error', err => {
            next(err);
        });

        blobStream.on('finish', () => {
            // The public URL can be used to directly access the file via HTTP.
            const publicUrl = format(
            `https://storage.googleapis.com/${bucket.name}/${blob.name}`
            );
            dataset['URL'] = publicUrl;
            upload_content(dataset)
        });

        blobStream.end(req.files[0].buffer);
        
    } else {
        upload_content(dataset)
    }
     
    function upload_content(dataset) {
        if (dataset.chat_id && dataset.content.length !== 0) {
            const q = `INSERT INTO faq_list 
            (chat_id, id, faq_content, created_date, update_date, faq_response, faq_response_img, response_type, img_type) 
            VALUES 
            (${dataset.chat_id}, ${dataset.id}, '${dataset.content}', now(), now(), '${dataset.response}', '${dataset.URL}', '${dataset.type}', '${dataset.img_type}')`
    
            conne.query(q, (rows) => {
                if (rows.affectedRows !== 0) {
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

router.post('/updateFaqlist', upload.array('response_img'), function(req, res) {
    const dataset = {
        chat_id : req.body.chat_id,
        response : req.body.response,
        question : req.body.question,
        type : req.body.response_type,
        response_img : req.files.length > 0 ? req.files[0].filename : '',
        image_type : req.body.img_type,
        id: req.body.id
    }
    if (dataset.response_img !== '') {
       // Create a new blob in the bucket and upload the file data.
       const blob = bucket.file(req.files[0].originalname);
       const blobStream = blob.createWriteStream({
           resumable: false,
       });

       blobStream.on('error', err => {
           next(err);
       });

       blobStream.on('finish', () => {
           // The public URL can be used to directly access the file via HTTP.
           const publicUrl = format(
           `https://storage.googleapis.com/${bucket.name}/${blob.name}`
           );
           dataset['URL'] = publicUrl;
           upload_content(dataset)
       });

       blobStream.end(req.files[0].buffer);
       
    } else {
        upload_content(dataset)
    }
     
    function upload_content(dataset) {
        if (dataset.chat_id && dataset.question.length !== 0) {
            const q = `
            UPDATE 
                faq_list 
            SET 
                faq_content='${dataset.question}', 
                faq_response='${dataset.response}',
                update_date=now(), 
                faq_response_img='${dataset.URL}', 
                response_type='${dataset.type}', 
                img_type='${dataset.image_type}' 
            WHERE 
                chat_id=${dataset.chat_id}
                AND
                id=${dataset.id}
            `

            conne.query(q, (rows) => {
                if (rows.affectedRows !== 0) {
                    res.status(200).send(true)
                } 
            })
        }
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
        // Create a new blob in the bucket and upload the file data.
        const blob = bucket.file(req.files[0].originalname);
        const blobStream = blob.createWriteStream({
            resumable: false,
        });

        blobStream.on('error', err => {
            next(err);
        });

        blobStream.on('finish', () => {
            // The public URL can be used to directly access the file via HTTP.
            const publicUrl = format(
            `https://storage.googleapis.com/${bucket.name}/${blob.name}`
            );
            dataset['URL'] = publicUrl;
            upload_content(dataset)
        });

        blobStream.end(req.files[0].buffer);
        
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

router.post('/delStartMenu', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `DELETE FROM start_menus WHERE chat_id=${chat_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.status(400).send('there is any word to be deleted. no action')
            }
        })
    }
})

router.post('/getOptions', function(req, res, next) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `SELECT is_img_filter, is_block_bot, is_ordering_comeout FROM chat WHERE id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.length > 0) {
                res.status(200).send(rows)
            } else {
                res.status(400)
            }
        })
    }
})

router.post('/setOptions', function(req, res) {
    const chat_id = req.body.chat_id;
    const img_filter = req.body.img_filter;
    const block_bot = req.body.block_bot;
    const order_del = req.body.order_del;

    if (chat_id) {
        const q = `UPDATE chat SET is_img_filter=${img_filter}, is_block_bot=${block_bot}, is_ordering_comeout=${order_del} WHERE id=${chat_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true);
            } else {
                res.status(400).send(false);
            }
        })
    }
})

router.post('/getMemberStatus', function(req, res) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `SELECT * FROM user_chat left outer join user on user_chat.user_id=user.id where chat_id=${chat_id} order by user.score;`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            }
        })
    }
})

router.post('/updateMemberChatCount', function(req, res) {
    const chat_id = req.body.chat_id;
    const member_id = req.body.member_id;
    const type = req.body.type;
    let update_target = '';

    if (type === 'txt') {
        update_target = 'act_txt_cnt'
    } else if (type === 'photo') {
        update_target = 'act_photo_cnt'
    }

    if (chat_id && member_id) {
        const q = `update user_chat set ${update_target}=${update_target} + 1 where chat_id=${chat_id} and user_id=${member_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200);
            } else {
                res.status(400);
            }
        })
    }
})

router.post('/deleteUser', function(req, res) {
    const chat_id = req.body.chat_id;
    const member_id = req.body.user_id;

    if (chat_id && member_id) {
        const q = `delete from user_chat where user_id=${member_id} and chat_id=${chat_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
    
})

router.post('/setStateModule', function(req, res) {
    const chat_id = req.body.chat_id;
    const target = req.body.target_id;
    const status = req.body.status;
    
    if (chat_id) {
        const q = `update chat set module_state_${target}=${status} where id=${chat_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
})

router.post('/getStateModule', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `select 
                chat.module_state_1 as module_1, 
                chat.module_state_2 as module_2, 
                chat.module_state_3 as module_3, 
                chat.module_state_4 as module_4, 
                chat.module_state_5 as module_5,
                chat.module_state_6 as module_6
            from 
                chat
            where
                id=${chat_id}
            ;`
        
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            }
        })
    }
})

router.post('/getQuestions', function(req, res) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `
            select
                message.chat_id,
                message.text,
                message.id,
                message.user_id,
                message.date,
                message.replied_date,
                message.reply_to_message,
                message.reply_to_chat,
                message.is_question,
                user.first_name,
                user.last_name
            from
                message
                left outer join
                user on message.user_id = user.id
            where
                chat_id=${chat_id}
                and
                is_question=1;
        `;

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            }
        })
    }

})

router.post('/setStateReplied', function(req, res) {
    const chat_id = req.body.chat_id;
    const message_id = req.body.reply_to_message_id;
 
    if (chat_id && message_id) {
        const q = `
            update
                message
            set
                replied_date = now()
            where
                chat_id = ${chat_id}
                and
                id = ${message_id}
                and
                is_question = 1
        `

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
})

router.post('/setInterest', function(req, res) {
    const chat_id = req.body.chat_id;
    const user_id = req.body.user_id;
    
    if (chat_id && user_id) {
        const q = `
            insert into interestlist (chat_id, user_id, registered_time) values (${chat_id}, ${user_id}, now())
        `

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
})

router.post('/getInterest', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `
            select 
                interestlist.user_id,
                interestlist.chat_id,
                interestlist.registered_time,
                message.text,
                message.id as message_id,
                message.date as message_date,
                message.entities,
                user.first_name,
                user.last_name 
            from 
                interestlist 
                left outer join
                message on (interestlist.user_id = message.user_id and interestlist.chat_id = message.chat_id)
                left outer join
                user on (interestlist.user_id = user.id)
            where 
                interestlist.chat_id=${chat_id}
        `
        
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            }
        })
    }
})

router.post('/getInterestMembers', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `
            select 
                interestlist.user_id,
                interestlist.chat_id,
                interestlist.registered_time,
                user.first_name,
                user.last_name 
            from 
                interestlist 
                left outer join
                user on (interestlist.user_id = user.id)
            where 
                interestlist.chat_id=${chat_id}
        `
        
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            }
        })
    }
})

router.post('/getExpectedWords', function(req, res, next) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `SELECT * FROM interest_words where chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        });
    }
})

router.post('/delExpectedWord', function(req, res) {
    const word_id = req.body.word_id;
    const chat_id = req.body.chat_id;
    
    if (word_id && chat_id) {
        const q = `
            DELETE FROM 
                interest_words
            WHERE
                chat_id=${chat_id}
                and
                idx=${word_id};
        `

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
})

router.post('/pushExpectWord', function(req, res) {
    const word = req.body.word;
    const chat_id = req.body.chat_id;

    if (word && chat_id) {
        const q = `
            insert into
                interest_words
                (
                    word_name,
                    chat_id,
                    created_time,
                    is_active
                )
            values 
                (
                    '${word}',
                    ${chat_id},
                    now(),
                    1
                )
        `

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
})

router.post('/editExpectedWord', function(req, res) {
    const type = req.body.type;
    const id = req.body.id;
    const is_active = req.body.content;
    
    let q = '';

    if (type === 'status') {
        q = `UPDATE interest_words SET is_active='${is_active}' WHERE idx=${id} and chat_id=${req.body.chat_id};`
    } 
    
    conne.query(q, (rows) => {
        if (rows.changedRows !== 0) {
            res.status(200).send(true)    
        } else {
            res.status(404).send('there is any word to be replaced. plase check a word again');
            return false;
        }
    })
})

router.post('/scoreUp', function(req, res) {
    const chat_id = req.body.chat_id;
    const user_id = req.body.user_id;
    const SCORE_UP_BY_ADMIN = 20;
    
    const q = `
        UPDATE user SET score = score + ${SCORE_UP_BY_ADMIN} WHERE id = ${user_id};
    `
    
    conne.query(q, (rows) => {
        if (rows.changedRows !== 0) {
            const query_count_bonus = `UPDATE user_chat SET get_bonus=get_bonus+1 WHERE user_id=${user_id} and chat_id=${chat_id};`
            conne.query(query_count_bonus, () => {
                res.status(200).send(rows);
            });
        } else {
            res.status(404).send(false);
        }
    })
})

module.exports = router;
