var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express', user: req.user }); //github認証成功時はreq.userが存在する。githubのアカウントの情報が入ってる
});

module.exports = router;
