'use strict';
const express = require('express');
const router = express.Router();

router.get('/',(req, res, next)=>{
  const from = req.query.from;   //ログインページへのgetリクエストが来たら、まずfromクエリを取得
  if(from){                      //fromクエリがあれば、（ログインが必要なページをログインせずに開こうとした場合fromクエリがある。authentication-ensurer.jsを参照）
    res.cookie('loginFrom', from, { expires: new Date(Date.now() + 600000) });  //そのfromクエリ(fromのurl)をloginFromクッキーとして保存。保存期間は 10 分
  }
  res.render('login');
});

module.exports = router;