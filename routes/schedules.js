'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('node-uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');

//ログイン時にしか/schedules/newが表示されないようにするため、new.jadeを表示させる前にミドルウェア「authenticationEnsurer」をかます
//authenticationEnsurerではすでにログインしてたらnext、ログインしてなかったら/loginへリダイレクトさせる処理を書いてる
router.get('/new', authenticationEnsurer, (req, res, next)=>{
  res.render('new', { user: req.user });
});

//予定作成フォームの送信先がここ　form(method="post", action="/schedules")
router.post('/', authenticationEnsurer, (req, res, next)=>{
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255), //DBの長さ制限があるため、.slice(0, 255) によって、予定名は255文字以内の文字の長さにする
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((schedule)=>{                                //予定の保存が完了したら(thenのonFulfilledの引数には保存した予定のインスタンスが入ってる)　onFulfilledはPromise が成功したとき呼ばれる関数の事
    //bulkCreateに渡す候補名のデータ（配列）の用意
    const candidateNames = req.body.candidates.trim().split('\n').map((s) => s.trim()); //候補名はフォーム上で改行区切りで複数投稿される。なので改行を区切りとして候補名たちの配列を生成(split)し、各候補名の余白を削除した配列を返してる(map)
    const candidates = candidateNames.map((c)=>{
      return {
        candidateName: c,
        scheduleId: schedule.scheduleId                //先ほど保存した予定のidを候補名の外部キーに設定
      };
    });
    //用意した配列を元に候補名の保存と、保存後のリダイレクト
    Candidate.bulkCreate(candidates).then(()=>{        //bulkCreateは複数のオブジェクトを保存する関数 http://docs.sequelizejs.com/class/lib/model.js~Model.html#static-method-bulkCreate
      res.redirect('/schedules/' + schedule.scheduleId);
    });
  });
});
//フォームからのデータ取得（req.bodyとreq.param）
//req.bodyにはフォームから送信された値がこんな感じで入ってる
//{ scheduleName: 'ラーメンを食べに行く',memo: 'とんこつラーメンか\r\n醤油とんこつラーメンで',candidates: '12/5の昼食\r\n12/6の昼食' }
//req.body http://expressjs.com/ja/api.html#req.body
//req.paramというものもあるが、非推奨らしい。こっちの方が直感的なのに。
//req.param('scheduleName') => 'ラーメンを食べに行く'
//req.param http://expressjs.com/ja/api.html#req.params
//ちなみにURLの:idとかの部分が取れるreq.paramsや、URLのクエリが取得できるreq.queryなどもある

module.exports = router;