'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('node-uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');
const Comment = require('../models/comment');

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

router.get('/:scheduleId', authenticationEnsurer, (req, res, next)=>{
  Schedule.findOne({                      //findOneは対応するデータを 1 行だけ取得する
    include:[                               //テーブルを結合してユーザーを取得する書き方。schedule.user というプロパティに、ユーザー情報が設定されます。
      {                                     //schedule.jadeにてschedule.user.usernameで、そのスケジュールの作成者名を表示させたいので。
        model: User,
        attributes: ['userId', 'username']  //ユーザーの属性としては、ユーザー ID とユーザー名を取得する
      }
    ],
    where:{
      scheduleId: req.params.scheduleId    //req.paramsでurlに含まれる:scheduleIdの取得。このidを元に予定を探す。req.paramsはrailsで言うところのprams[:id]みたいな処理
    },
    order: '"updatedAt" DESC'
  }).then((schedule)=>{                  //:scheduleIdの予定が見つかったら
    if(schedule){
      Candidate.findAll({
          where: {scheduleId: schedule.scheduleId },  //見つかった予定のidを元に候補のデータを探す。（候補の外部キーはscheduleId）
          order: '"candidateId" ASC'
      }).then((candidates)=>{            //作成ユーザーが紐付いた予定データと、候補データが取得できたら
        // データベースからその予定のすべての出欠を取得する
        Availability.findAll({                    //findallで対応するデータをすべて取得する
          include:[                                 //availability.user でその出欠にひもづくユーザー情報を手に入れるため、テーブルを結合しておく
            {
              model: User,
              attributes: ['userId', 'username']    //手に入れる「その出欠に紐付いたユーザー情報」はユーザーidとユーザー名
            }
          ],
          where: { scheduleId: schedule.scheduleId },
          order: '"user.username" ASC, "candidateId" ASC'
        }).then((availabilities)=>{
          // 出欠MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
          // 最終的にavailabilityMapMapはこんな感じになる　Map { '15885373' => Map { 13 => 0, 14 => 0, 15 => 0 } }
          const availabilityMapMap = new Map();          // key: userId, value: Map(key: candidateId, availability)
          availabilities.forEach((a)=>{
            //内側のmapを作る
            const map = availabilityMapMap.get(a.user.userId) || new Map();
            map.set(a.candidateId, a.availability);
            //作った内側のmapを外側のmapのバリューにセットする
            availabilityMapMap.set(a.user.userId, map);  //includeでテーブルを結合しておいたからa.user.userIdが使える
          });

          //閲覧ユーザーと出欠に紐づくユーザーからユーザー Map (キー:ユーザー ID, 値:ユーザー) を作る
          const usersMap = new Map();                           // key: userId, value: User
          //まずは閲覧ユーザーの情報を入れる
          usersMap.set(parseInt(req.user.id),{                  //parseIntは文字列を整数に変換してる
            isSelf: true,                                      //リクエストが来たユーザーidはcurrent_userなのでisSelfはtrue
            userId: parseInt(req.user.id),
            username: req.user.username
          });
          //出欠データを回してそれぞれの出欠データにひもづくユーザー情報を入れる
          availabilities.forEach((a)=>{
            usersMap.set(a.user.userId, {
              isSelf: parseInt(req.user.id) === a.user.userId, //リクエストが来たユーザーでないならisSelfではないのでfalse
              userId: a.user.userId,
              username: a.user.username
            });
          });

          // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
          const users = Array.from(usersMap).map((userMap)=>{ return userMap[1] });  //各ユーザーのisSelf,userId,usernameのオブジェクトが詰まった配列を作る
          users.forEach((u)=>{                                                       //ユーザーを回して
            candidates.forEach((c)=>{                                                   //候補データを回して（candidatesはかなり前のthenを見て。）
              const map = availabilityMapMap.get(u.userId) || new Map();                 //そのユーザーのバリュー(map)を処理するのが初めてならnew Mapする
              const a = map.get(c.candidateId) || 0;                                     // デフォルト値は 0 を利用
              map.set(c.candidateId, a);
              availabilityMapMap.set(u.userId, map);
            });
          });

          console.log(availabilityMapMap) //todo 除去

          //ちなみにcandidates（候補） は出欠データがひも付いている。（候補 has_many 出欠）こんな感じで候補にひもづく出欠データを取得できる。
          //ここでは使ってないけどスニペットとして書いとく
          //has_manyのインスタンスはここのapiが使える　http://docs.sequelizejs.com/class/lib/associations/has-many.js~HasMany.html#instance-method-get
          candidates.forEach((c)=>{
            c.getAvailabilities().then((availabilities)=>{  //has_manyなテーブルを複数形にして頭にgetを付ける。返り値はpromiseなのでthenで受け取る
              console.log(availabilities);
            });
          });
          //コメント取得
          Comment.findAll({
            where: { scheduleId: schedule.scheduleId }
          }).then((comments) => {
            const commentMap = new Map();  // key: userId, value: comment
            comments.forEach((comment) => {
              commentMap.set(comment.userId, comment.comment);
            });
            res.render('schedule', {
              user: req.user,
              schedule: schedule,
              candidates: candidates,
              users: users,
              availabilityMapMap: availabilityMapMap,
              commentMap: commentMap
            });
          });
        });
      });
    } else {
      const err = new Error('指定された予定は見つかりません');
      err.status = 404;
      next(err);
    }
  });
})


module.exports = router;