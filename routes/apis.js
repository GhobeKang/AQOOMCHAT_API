var express = require('express');
var router = express.Router();
var DB = require('../public/javascripts/query');
var conne = new DB('localhost', 'root', 'term!ner1', 'aqoom');
if (conne) {
  console.log('connected with DB successfully');
}

/* GET home page. */
router.get('/help', function(req, res, next) {
  res.render('usage', {title : 'api usages'})
});

router.post('/checkValidation', function(req, res, next) {
    const dataset = {
        type : 'group',
        title : req.body.title
    }
    const q = `SELECT * FROM chat WHERE type like '%${dataset.type}%' and title='${dataset.title}';`
    
    conne.query(q, (rows) => {
        if (rows.length !== 0) {
            res.send({id: rows[0].id})
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

module.exports = router;
