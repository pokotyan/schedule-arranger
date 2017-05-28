'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const parseReqFacebook = require('./parse-req-facebook');
const uuid = require('node-uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');
const Comment = require('../models/comment');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

//ログイン時にしか/schedules/newが表示されないようにするため、new.jadeを表示させる前にミドルウェア「authenticationEnsurer」をかます
//authenticationEnsurerではすでにログインしてたらnext、ログインしてなかったら/loginへリダイレクトさせる処理を書いてる
router.get('/new', authenticationEnsurer, csrfProtection, (req, res, next)=>{
  res.render('new', { user: req.user, csrfToken: req.csrfToken() });
});

//予定作成フォームの送信先がここ　form(method="post", action="/schedules")
router.post('/', authenticationEnsurer, parseReqFacebook, csrfProtection, (req, res, next)=>{
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255), //DBの長さ制限があるため、.slice(0, 255) によって、予定名は255文字以内の文字の長さにする
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((schedule)=>{                                //予定の保存が完了したら(thenのonFulfilledの引数には保存した予定のインスタンスが入ってる)　onFulfilledはPromise が成功したとき呼ばれる関数の事
    createCandidatesAndRedirect(parseCandidateNames(req), scheduleId, res);
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

//スケジュール詳細ページの表示
router.get('/:scheduleId', authenticationEnsurer, parseReqFacebook, (req, res, next)=>{
  let storedSchedule = null;
  let storedCandidates = null;
  Schedule.findOne({                                   //findOneは対応するデータを 1 行だけ取得する
    include:[                                          //テーブルを結合してユーザーを取得する書き方。schedule.user というプロパティに、ユーザー情報が設定されます。
      {                                                //schedule.jadeにてschedule.user.usernameで、そのスケジュールの作成者名を表示させたいので。
        model: User,
        attributes: ['userId', 'username']             //ユーザーの属性としては、ユーザー ID とユーザー名を取得する
      }
    ],
    where:{
      scheduleId: req.params.scheduleId                //req.paramsでurlに含まれる:scheduleIdの取得。このidを元に予定を探す。req.paramsはrailsで言うところのprams[:id]みたいな処理
    },
    order: '"updatedAt" DESC'
  }).then((schedule)=>{                                //:scheduleIdの予定が見つかったら
    if(schedule){
      storedSchedule = schedule;
      return Candidate.findAll({
          where: {scheduleId: schedule.scheduleId },   //見つかった予定のidを元に候補のデータを探す。（候補の外部キーはscheduleId）
          order: '"candidateId" ASC'
      });
    } else {
      const err = new Error('指定された予定は見つかりません');
      err.status = 404;
      next(err);
    }
  }).then((candidates)=>{                              //作成ユーザーが紐付いた予定データと、候補データが取得できたら
    // データベースからその予定のすべての出欠を取得する
    storedCandidates = candidates;
    return Availability.findAll({                      //findallで対応するデータをすべて取得する
      include:[                                        //availability.user でその出欠にひもづくユーザー情報を手に入れるため、テーブルを結合しておく
        {
          model: User,
          attributes: ['userId', 'username']           //手に入れる「その出欠に紐付いたユーザー情報」はユーザーidとユーザー名
        }
      ],
      where: { scheduleId: storedSchedule.scheduleId },
      order: '"user.username" ASC, "candidateId" ASC'
    });
  }).then((availabilities)=>{
    // 出欠MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
    // 最終的にavailabilityMapMapはこんな感じになる　Map { '15885373' => Map { 13 => 0, 14 => 0, 15 => 0 } }
    const availabilityMapMap = new Map();              // key: userId, value: Map(key: candidateId, availability)
    availabilities.forEach((a)=>{
      //内側のmapを作る
      const map = availabilityMapMap.get(a.user.userId) || new Map();
      map.set(a.candidateId, a.availability);
      //作った内側のmapを外側のmapのバリューにセットする
      availabilityMapMap.set(a.user.userId, map);      //includeでテーブルを結合しておいたからa.user.userIdが使える
    });

    //閲覧ユーザーと出欠に紐づくユーザーからユーザー Map (キー:ユーザー ID, 値:ユーザー) を作る
    const usersMap = new Map();                        // key: userId, value: User
    //まずは閲覧ユーザーの情報を入れる
    usersMap.set(req.user.id,{
      isSelf: true,                                    //リクエストが来たユーザーidはcurrent_userなのでisSelfはtrue
      userId: req.user.id,
      username: req.user.username
    });
    //出欠データを回してそれぞれの出欠データにひもづくユーザー情報を入れる
    availabilities.forEach((a)=>{
      usersMap.set(a.user.userId, {
        isSelf: req.user.id === a.user.userId,         //リクエストが来たユーザーでないならisSelfではないのでfalse
        userId: a.user.userId,
        username: a.user.username
      });
    });

    // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
    const users = Array.from(usersMap).map((userMap)=>{ return userMap[1] });  //各ユーザーのisSelf,userId,usernameのオブジェクトが詰まった配列を作る
    users.forEach((u)=>{                                                       //ユーザーを回して
      storedCandidates.forEach((c)=>{                                                //候補データを回して（candidatesはかなり前のthenを見て。）
        const map = availabilityMapMap.get(u.userId) || new Map();             //そのユーザーのバリュー(map)を処理するのが初めてならnew Mapする
        const a = map.get(c.candidateId) || 0;                                 // デフォルト値は 0 を利用
        map.set(c.candidateId, a);
        availabilityMapMap.set(u.userId, map);
      });
    });

    console.log(availabilityMapMap) //todo 除去

    //ちなみにcandidates（候補） は出欠データがひも付いている。（候補 has_many 出欠）こんな感じで候補にひもづく出欠データを取得できる。
    //ここでは使ってないけどスニペットとして書いとく
    //has_manyのインスタンスはここのapiが使える　http://docs.sequelizejs.com/class/lib/associations/has-many.js~HasMany.html#instance-method-get
    storedCandidates.forEach((c)=>{
      c.getAvailabilities().then((availabilities)=>{  //has_manyなテーブルを複数形にして頭にgetを付ける。返り値はpromiseなのでthenで受け取る
        console.log(availabilities);
      });
    });
    //コメント取得
    Comment.findAll({
      where: { scheduleId: storedSchedule.scheduleId }
    }).then((comments) => {
      const commentMap = new Map();  // key: userId, value: comment
      comments.forEach((comment) => {
        commentMap.set(comment.userId, comment.comment);
      });
      res.render('schedule', {
        user: req.user,
        schedule: storedSchedule,
        candidates: storedCandidates,
        users: users,
        availabilityMapMap: availabilityMapMap,
        commentMap: commentMap
      });
    });
  });
});

//スケジュール編集ページの表示
router.get('/:scheduleId/edit', authenticationEnsurer, parseReqFacebook, csrfProtection,(req, res, nest)=>{
  Schedule.findOne({
    where: {
      scheduleId: req.params.scheduleId
    }
  }).then((schedule)=>{
    if(isMine(req, schedule)){ // スケジュール作成者のみが編集フォームを開ける
      Candidate.findAll({
        where: { scheduleId: schedule.scheduleId },
        order: '"candidateId" ASC'
      }).then((candidates)=>{
        res.render('edit', {
          user: req.user,
          schedule: schedule,
          candidates: candidates,
          csrfToken: req.csrfToken()
        });
      });
    }else{
      const err = new Error('指定された予定がない、または予定する権限がありません');
      err.status = 404;
      next(err);
    }
  });
});
function isMine(req, schedule){
  return schedule && parseInt(schedule.createdBy) === req.user.id;
}

//スケジュールの編集と候補の追加の処理。スケジュール編集フォームの送信先（ /schedules/#{schedule.scheduleId}?edit=1 ）がここ
//スケジュールの削除処理。スケジュール削除ボタンの送信先（ /schedules/#{schedule.scheduleId}?delete=1 ）がここ
router.post('/:scheduleId', authenticationEnsurer, parseReqFacebook, csrfProtection, (req, res, next)=>{
  //クエリが予定編集の時
  if(parseInt(req.query.edit) === 1){
    Schedule.findOne({
      where:{
        scheduleId: req.params.scheduleId
      }
    }).then((schedule)=>{
      //予定作成者しかその予定の編集はできない
      if(!(isMine(req, schedule))){
        const err = new Error('指定された予定がない、または、編集する権限がありません');
        err.status = 404;
        next(err);
      }
      //予定作成者であれば予定編集の処理を続ける
      const userId = String(req.user.id).length > 9 ? String(req.user.id).slice(0, 9) : req.user.id  //facebookのidは長すぎるので短くする
      const updatedAt = new Date();
      return schedule.update({
        scheduleId: schedule.scheduleId,
        scheduleName: req.body.scheduleName.slice(0, 255),
        memo: req.body.memo,
        createdBy: userId,
        updatedAt: updatedAt
      });
    }).then((schedule)=>{
      const candidateNames = parseCandidateNames(req);                         //改行して複数入力された候補をパースして候補の配列を作成
      if (candidateNames) {
        createCandidatesAndRedirect(candidateNames, schedule.scheduleId, res); //候補の配列を用いて、スケジュールにひもづく候補の作成と編集後のスケジュール詳細ページへのリダイレクト
      } else {                                                                 //候補の配列が空（候補の更新はしていない時）
        res.redirect('/schedules/' + schedule.scheduleId);                     //編集後のスケジュール詳細ページへリダイレクト
      }
    });
  //クエリが削除の時
  } else if(parseInt(req.query.delete) === 1){
    deleteScheduleAggregate(req.params.scheduleId, ()=>{
      res.redirect('/');
    });
  //クエリが想定外の時
  } else {
    const err = new Error('不正なリクエストです');
    err.status = 400;
    next(err);    
  }
});

function deleteScheduleAggregate(scheduleId, done, err){             //errはここでは使わないが、test/test.jsでこの関数を使った時に使う可能性がある
  //コメントの削除
  Comment.findAll({
    where: { scheduleId: scheduleId }
  }).then((comments)=>{
    return Promise.all(comments.map((c)=>{ return c.destroy(); }));  //destroyの返り値はpromiseなので、それを引数にPromise.allで削除実行
  });
  //出欠の削除
  Availability.findAll({
    where: { scheduleId: scheduleId }
  }).then((availabilities)=>{
    return Promise.all(availabilities.map((a)=>{ return a.destroy(); }));
  //候補の削除
  }).then(()=>{
    return Candidate.findAll({
      where: { scheduleId: scheduleId }
    });
  }).then((candidates)=>{
    return Promise.all(candidates.map((c)=>{ return c.destroy(); }));
  //スケジュールの削除
  }).then(()=>{
    return Schedule.findById(scheduleId).then((s)=>{ return s.destroy(); });
  //引数でもらったコールバック（done）の実行
  }).then(()=>{
    if (err) return done(err);
    done();
  });
}
router.deleteScheduleAggregate = deleteScheduleAggregate;  // test/test.jsでも使うので公開apiにする

//予定の新規作成と予定の編集の時に呼ばれる関数。
//予定にひもづく候補を作って、作った予定詳細ページにリダイレクトする
function createCandidatesAndRedirect(candidateNames, scheduleId, res) {
  //bulkCreateに渡す候補名のデータ（配列）の用意
  const candidates = candidateNames.map((c)=>{
    return {
      candidateName: c,
      scheduleId: scheduleId
    };
  });
  //用意した配列を元に候補名の保存と、保存後のリダイレクト
  Candidate.bulkCreate(candidates).then(()=>{  //bulkCreateは複数のオブジェクトを保存する関数 http://docs.sequelizejs.com/class/lib/model.js~Model.html#static-method-bulkCreate
    res.redirect('/schedules/' + scheduleId);
  });
}
//候補名はフォーム上で改行区切りで複数投稿される。なので改行を区切りとして候補名たちの配列を生成(split)し、各候補名の余白を削除した配列を返してる(map)
function parseCandidateNames(req) {
  return req.body.candidates.trim().split('\n').map((s) => s.trim());
}



module.exports = router;