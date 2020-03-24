var express = require('express');
var crypto = require('crypto');
var multer = require('multer');
const {format} = require('util');
var cookieParser = require('cookie-parser');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

var router = express.Router();
router.use(cookieParser());

var DB = require('../public/javascripts/query');

var develop_env = 0;

if (develop_env) {
    var conne = new DB('34.97.24.74', 'root', 'aq@@mServ!ce', 'aqoomchat');
    var botkey = '822428347:AAGXao7qTxCL5MoqQyeSqPc7opK607fA51I';
} else {
    var conne = new DB('34.97.24.74', 'root', 'aq@@mServ!ce', 'aqoomchat');
    var botkey = '847825836:AAFv02ESsTVjnrzIomgdiVjBGWVw7CpN_Cg';
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
var bot = new TelegramBot(botkey, {polling: false});
var schedule_msg = [];

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

router.post('/checkValidation', function(req, res, next) {
    const dataset = {
        type : 'group',
        id : req.body.id
    }
    const q = `
        SELECT 
            * 
        FROM 
            user_chat
            left outer join
            chat ON (user_chat.chat_id = chat.id)
        WHERE 
            user_chat.user_id=${dataset.id}
            and
            chat.type like '%${dataset.type}%'`
    
    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            const admin_check_q = `select user.is_admin from user where id=${dataset.id};`
            conne.query(admin_check_q, (r) => {
                if (r[0]) {
                    const crypto_ = crypto.createHash('sha1')
                    crypto_.update(Date.now().toString());
                    
                    const q = `UPDATE chat SET is_active=1, activation_code='${crypto_.digest('hex')}' WHERE id='${rows[0].chat_id}';`
                    conne.query(q, (result) => {
                        let chat_id_arr = [];
                        for (var item of rows) {
                            chat_id_arr.push(item.chat_id)
                        }
                        res.cookie('living', '1', { expires: new Date(Date.now() + 7200000)}).send({id: chat_id_arr})
                    })
                }
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
    if (!req.body.id) {
        res.status(404).send('parameter was missing.')
        return false;
    }

    const q = `DELETE FROM forb_wordlist WHERE id='${req.body.id}' and chat_id=${req.body.chat_id};`
    conne.query(q, (rows) => {
        if (rows.affectedRows !== 0) {
            res.status(200).send(true)
        } else {
            res.status(200).send(false)
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
    const whitelist_id = req.body.id;
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `DELETE FROM whitelist_url WHERE id='${whitelist_id}' AND chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.status(200).send(false)
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
        content : req.body.keyword,
        type : req.body.response_type,
        response_img : req.files.length > 0 ? req.files[0].filename : '',
        image_type : req.body.img_type,
        id: req.body.id || Math.floor((Math.random() * 100000) + 1),
        keyword_type: req.body.keyword_type,
        inline_btns: req.body.inline_btns,
        onEditing: req.body.onEditing
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
        if (dataset.chat_id && dataset.content.length !== 0 && dataset.onEditing == 0) {
            const q = `INSERT INTO faq_list 
            (chat_id, id, faq_content, created_date, update_date, faq_response, faq_response_img, response_type, img_type, keyword_type, buttons) 
            VALUES 
            (${dataset.chat_id}, ${dataset.id}, '${dataset.content}', now(), now(), '${dataset.response}', '${dataset.URL}', '${dataset.type}', '${dataset.img_type}', ${dataset.keyword_type}, '${dataset.inline_btns}')`
    
            conne.query(q, (rows) => {
                if (rows.affectedRows !== 0) {
                    res.status(200).send(true)
                } 
            })
        } else if (dataset.chat_id && dataset.onEditing == 1 && dataset.id) {
            const q = `
                UPDATE faq_list SET faq_content='${dataset.content}', update_date=now(), faq_response='${dataset.response}', faq_response_img='${dataset.URL}', response_type='${dataset.type}', img_type='${dataset.img_type}', keyword_type=${dataset.keyword_type}, buttons='${dataset.inline_btns}' WHERE id=${dataset.id} and chat_id=${dataset.chat_id}
            `

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
    const faq_id = req.body.id;
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `DELETE FROM faq_list WHERE id=${faq_id} AND chat_id=${chat_id}`

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
        image_type : req.body.img_type,
        inline_btns: req.body.inline_btns
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
    
    function upload_content (dataset) {
        if (dataset.chat_id && !req.body.id) {
            var q = `
            UPDATE start_menus SET is_active=0 WHERE chat_id=${dataset.chat_id};
            INSERT INTO start_menus 
            (chat_id, content_txt, content_img, img_type, response_type, created_date, update_date, is_active, buttons) 
            VALUES 
            (${dataset.chat_id}, '${dataset.content_txt}', '${dataset.URL}', '${dataset.image_type}', '${dataset.content_type}', now(), now(), 1, '${dataset.inline_btns}');`

            conne.query(q, (rows) => {
                if (rows.affectedRows !== 0) {
                    res.status(200).send(true)
                } 
            })
        } else if (req.body.id && dataset.chat_id) {
            var q = `
                UPDATE start_menus SET is_active=0 WHERE chat_id=${dataset.chat_id};
                UPDATE start_menus SET is_active=1, content_txt='${dataset.content_txt}', content_img='${dataset.content_img}', img_type='${dataset.image_type}', update_date=now(), buttons='${dataset.inline_btns}' WHERE chat_id=${dataset.chat_id} and id=${req.body.id};
            `

            conne.query(q, (rows) => {
                if (rows.affectedRows !== 0) {
                    res.status(200).send(true)
                } 
            })
        }
    }

})

router.post('/getStartMenu', function(req, res, next) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `SELECT * FROM start_menus WHERE chat_id=${chat_id} and is_active=1`

        conne.query(q, (rows) => {
            if (rows.length > 0) {
                res.status(200).send(rows)
            } else {
                res.status(400)
            }
        })
    }
})

router.post('/getStartMenuAll', function(req, res, next) {
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
    const welcome_id = req.body.id;

    if (chat_id) {
        const q = `DELETE FROM start_menus WHERE chat_id=${chat_id} and id=${welcome_id};`

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
        const q = `SELECT * FROM user_chat left outer join user on user_chat.user_id=user.id where chat_id=${chat_id} order by user_chat.is_interested desc, user.score desc;`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            }
        })
    }
})

router.post('/getMember', function(req, res) {
    const member_id = req.body.member_id;
    const chat_id = req.body.chat_id;
    
    if (member_id && chat_id ) {
        const q = `SELECT * FROM user_chat left outer join user on user_chat.user_id=user.id where user_id=${member_id} and chat_id=${chat_id};`

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
                (
                    is_question = 1
                    or
                    is_mention = 1
                )
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
    const val = req.body.val;

    if (chat_id && user_id) {
        const q = `
            update user_chat set is_interested=${val} where user_id=${user_id} and chat_id=${chat_id}
        `

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.send(false)
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

router.post('/getMessageCntPerDay', function(req, res) {
    const member_id = req.body.member_id;
    const chat_id = req.body.chat_id;
    
    if (member_id && chat_id) {
        const q = `select concat(cast(monthname(date) as char(3)),' ', day(date)) as ym, count(*) as cnt from message where chat_id=${chat_id} and user_id=${member_id} group by ym;`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        })    
    }
})

router.post('/getMessageCntPerHour', function(req, res) {
    const member_id = req.body.member_id;
    const chat_id = req.body.chat_id;
    
    if (member_id && chat_id) {
        const q = `select hour(date) as hour, count(*) as cnt from message where chat_id=${chat_id} and user_id=${member_id} and date > curdate() - interval 1 day group by hour(date)`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        })    
    }
})

router.post('/getMessageByUser', function(req, res) {
    const chat_id = req.body.chat_id;
    const user_id = req.body.member_id;
    const until_when = req.body.date;

    if (chat_id && user_id) {
        const q = `
            select 
                message.chat_id,
                message.text,
                message.photo,
                message.sticker,
                message.video,
                message.audio,
                message.entities,
                message.id,
                message.user_id,
                message.date,
                message.replied_date,
                message.reply_to_message,
                message.reply_to_chat,
                message.is_question,
                user.first_name,
                user.last_name,
                user.username
            from
                message
                left outer join
                user on message.user_id = user.id 
            where
                chat_id=${chat_id}
                and
                user_id=${user_id}
                and
                date > curdate() - interval ${until_when} day
            order by date desc
        `
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows);
            } else {
                res.send(false);
            }
        })
    }
})

router.post('/getMessageById', function(req, res) {
    const chat_id = req.body.chat_id;
    const message_id = req.body.message_id;

    if (chat_id && message_id) {
        const q = `
            select
                message.chat_id,
                message.text,
                message.photo,
                message.sticker,
                message.video,
                message.audio,
                message.entities,
                message.id,
                message.user_id,
                message.date,
                message.replied_date,
                message.reply_to_message,
                message.reply_to_chat,
                message.is_question,
                user.first_name,
                user.last_name,
                user.username
            from
                message
                left outer join
                user on message.user_id = user.id 
            where 
                chat_id=${chat_id}
                and
                message.id=${message_id}
            `
        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows);
            } else {
                res.send(false);
            }
        })
    }
})

router.post('/getMessages', function(req, res) {
    const page = req.body.page;
    const limit = page * 20
    const chat_id = req.body.chat_id;
    
    if (limit !== undefined && chat_id) {
        const q = `
        select
            message.chat_id,
            message.text,
            message.photo,
            message.sticker,
            message.video,
            message.audio,
            message.entities,
            message.id,
            message.user_id,
            message.date,
            message.replied_date,
            message.reply_to_message,
            message.reply_to_chat,
            message.is_question,
            user.first_name,
            user.last_name,
            user.username
        from
            message
            left outer join
            user on message.user_id = user.id 
        where 
            chat_id=${chat_id}
        order by date desc
        limit ${limit}, 20`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        })  
    }
})

router.post('/getQuestions', function(req, res) {
    const chat_id = req.body.chat_id;
    const cr_page = req.body.page;
    const limit = cr_page * 20;

    if (chat_id) {
        const q = `
            select
                message.chat_id,
                message.text,
                message.photo,
                message.sticker,
                message.video,
                message.audio,
                message.entities,
                message.id,
                message.user_id,
                message.date,
                message.replied_date,
                message.reply_to_message,
                message.reply_to_chat,
                message.is_question,
                user.first_name,
                user.last_name,
                user.username
            from
                message
                left outer join
                user on message.user_id = user.id
            where
                chat_id=${chat_id}
                and
                is_question=1
            order by date desc
            limit ${limit}, 20;
        `;

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        })
    }

})

router.post('/removeMessage', function(req, res) {
    const chat_id = req.body.chat_id;
    const message_id = req.body.message_id;

    if (chat_id && message_id) {
        const q = `delete from telegram_update where chat_id=${chat_id} and message_id=${message_id}; 
                    delete from message where chat_id=${chat_id} and id=${message_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } 
        })
    }
    
})

router.post('/searchMember', function(req, res) {
    const chat_id = req.body.chat_id;
    const query = req.body.query;
    
    if (chat_id && query.length > 0) {
        const q = `
        select 
            * 
        from 
            user_chat 
            left outer join 
            user on (user_chat.user_id = user.id) 
        where 
            chat_id=${chat_id} 
            and 
            (first_name like '%${query}%' 
            or 
            last_name like '%${query}%')`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        })
    }
})

router.post('/getAdminMentions', function(req, res) {
    const chat_id = req.body.chat_id
    const page = req.body.page;
    const limit = page * 20;

    if (chat_id) {
        const q = `
        select
            message.chat_id,
            message.text,
            message.photo,
            message.sticker,
            message.video,
            message.audio,
            message.entities,
            message.id,
            message.user_id,
            message.date,
            message.replied_date,
            message.reply_to_message,
            message.reply_to_chat,
            message.is_question,
            user.first_name,
            user.last_name,
            user.username
        from
            message
            left outer join
            user on message.user_id = user.id
        where 
            chat_id=${chat_id}
            and
            is_mention=1
        order by date desc
        limit ${limit}, 20;`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows)
            } else {
                res.send(false)
            }
        })
    }
})

router.post('/setAnnounce', upload.array('content_img'), function(req, res) {
    const chat_id = req.body.chat_id;
    const schedule_id = Math.floor(Math.random() * 1000000);

    if (chat_id) {
        let message_content = req.body.content;

        if (!req.body.content_type) {
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
                message_content = publicUrl;
            });

            blobStream.end(req.files[0].buffer);
        }

        const q = `
            replace into chat_announcement (chat_id, schedule_id, schedule_type, content, schedule_month, schedule_dayofmonth, schedule_dayofweek, schedule_hour, schedule_min)
            values (
                ${req.body.chat_id},
                ${schedule_id},
                '${req.body.type}',
                '${message_content}',
                ${req.body.month ? req.body.month : null},
                ${req.body.monthofday ? req.body.monthofday : null},
                ${req.body.weekofday ? req.body.weekofday : null},
                ${req.body.hour},
                ${req.body.min}
            )
        `
        const q_timezone = `select chat_timezone.timezone as timezone from chat_timezone where chat_id=${chat_id}`;

        conne.query(q_timezone, (result) => {
            let tz = '';

            if (result.length !== 0) {
                console.log(result[0].timezone)
                tz = JSON.parse(result[0].timezone);
                tz = tz[0];
            } else {
                tz = 'America/New_York';
            }

            const scheduleTask = cron.schedule(`
                ${req.body.min} 
                ${req.body.hour} 
                ${req.body.monthofday ? req.body.monthofday : '*'} 
                ${req.body.month ? req.body.month : '*'} 
                ${req.body.weekofday ? req.body.weekofday : '*'}`, () => {
                    if (req.body.content_type) {
                        bot.sendMessage(req.body.chat_id, message_content)
                    } else {
                        bot.sendPhoto(req.body.chat_id, message_content)
                    }
                }, {
                    timezone: tz,
                    scheduled: false
                })
            
            schedule_msg[schedule_id] = scheduleTask;

            schedule_msg[schedule_id].start()
        })

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                const dataset = {
                    content: message_content,
                    schedule_id: schedule_id
                }
                res.status(200).send(dataset)
            } 
        }) 
    }
})

router.post('/getAnnounce', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `
            SELECT * FROM chat_announcement WHERE chat_id = ${chat_id}
        `

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows);
            } else {
                res.send(false);
            }
        })
    }
})

router.post('/delAnnounce', function(req, res) {
    const chat_id = req.body.chat_id;
    const id = req.body.ann_id;

    if (chat_id && id) {
        const q = `DELETE FROM chat_announcement WHERE chat_id=${chat_id} and schedule_id=${id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                schedule_msg[id].stop();
                res.status(200).send(true)
            } else {
                res.status(400).send('there is any word to be deleted. no action')
            }
        })
    }
})

router.post('/getAnti', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `SELECT * FROM anti_spam_options WHERE chat_id=${chat_id};`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows);
            } else {
                res.send(false);
            }
        })
    }
})

router.post('/updateAnti', function(req, res) {
    const chat_id = req.body.chat_id;
    const target_field = req.body.field;

    if (chat_id) {
        const q = `UPDATE anti_spam_options SET ${target_field}=1 WHERE chat_id=${chat_id};`

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.status(400).send('there is any word to be deleted. no action')
            }
        })
    }
})

router.post('/setTimezone', function(req, res) {
    const chat_id = req.body.chat_id;
    const offset = req.body.offset;
    const timezones = req.body.timezone;
    const pos = req.body.position;
    
    if (chat_id && offset) {
        const q = `
            replace into chat_timezone (id, chat_id, timezone, offset, tz_pos) values (${Math.floor(Math.random() * 10000 + 1)}, ${chat_id}, '${timezones}', ${offset}, ${pos})
        `

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(timezones)
            } else {
                const default_val = {
                    timezone: 'America/New_York',
                    offset: -4
                }
                res.status(200).send(default_val)
            }
        }) 

    }
})

router.post('/getTimezone', function(req, res) {
    const chat_id = req.body.chat_id;

    if (chat_id) {
        const q = `SELECT * FROM chat_timezone WHERE chat_id=${chat_id}`

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows);
            } else {
                res.send(false);
            }
        })
    }
})

router.post('/updateStateSlashs', function(req, res) {
    const chat_id = req.body.chat_id;
    const status = req.body.status;
    
    if (chat_id) {
        const q = `UPDATE anti_spam_options SET anti_slash=${status} WHERE chat_id=${chat_id}`;

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true)
            } else {
                res.status(200).send(false)
            }
        }) 
    }
})

router.post('/getUserWhitelist', function(req, res) {
    const chat_id = req.body.chat_id;
    
    if (chat_id) {
        const q = `
            SELECT 
                user_whitelist.id,
                user_whitelist.username
            FROM 
                user_whitelist
            WHERE 
                chat_id=${chat_id}`;

        conne.query(q, (rows) => {
            if (rows.length !== 0) {
                res.send(rows);
            } else {
                res.send(false);
            }
        })
    }
})

router.post('/setUserWhitelist', function(req, res) {
    const chat_id = req.body.chat_id;
    const username = req.body.username;
    
    if (chat_id && username) {
        const q = `REPLACE INTO user_whitelist (chat_id, username) VALUES (${chat_id}, '${username}');`;

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true);
            } else {
                res.status(200).send(false);
            }
        })
    }
})

router.post('/delWhiteUser', function(req, res) {
    const chat_id = req.body.chat_id;
    const id = req.body.id;

    if (chat_id) {
        const q = `DELETE FROM user_whitelist WHERE chat_id=${chat_id} and id=${id}`;

        conne.query(q, (rows) => {
            if (rows.affectedRows !== 0) {
                res.status(200).send(true);
            } else {
                res.status(200).send(false);
            }
        })
    }
})

module.exports = router;
