'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');

//ログイン時にしか/schedules/newが表示されないようにするため、new.jadeを表示させる前にミドルウェア「authenticationEnsurer」をかます
//authenticationEnsurerではすでにログインしてたらnext、ログインしてなかったら/loginへリダイレクトさせる処理を書いてる
router.get('/new', authenticationEnsurer, (req, res, next)=>{
  res.render('new', { user: req.user });
});

//予定作成フォームの送信先がここ　form(method="post", action="/schedules")
router.post('/', authenticationEnsurer, (req, res, next)=>{
  console.log(req.body); // TODO 予定と候補を保存する実装をする
  res.redirect('/');
});

module.exports = router;