'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
const assert = require('assert');
let User = require('../models/user');
let Schedule = require('../models/schedule');
let Candidate = require('../models/candidate');
let Availability = require('../models/availability');
let Comment = require('../models/comment');
const deleteScheduleAggregate = require('../routes/schedules').deleteScheduleAggregate;

describe('/login',()=>{
  //before 関数で記述された処理は describe 内のテスト前に実行されます
  //after 関数で記述された処理は describe 内のテストの後に実行されます。
  //これは mocha の機能で、他にも各 it 内のテストの前後に実行させる処理も記述できます。

  //テストの前に passportStub を app オブジェクトにインストールし、 testuser というユーザー名のユーザーでログインしています。
  before(()=>{
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });
  //テストの後は、ログアウトして、アンインストールする処理を実行しています。
  after(()=>{
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('ログインのためのリンクが含まれる',(done)=>{
    request(app)
      .get('/login')                                        // /login への GET リクエストを作成します。
      .expect('Content-Type', 'text/html; charset=utf-8')   //文字列を 2 つ引数として渡し、ヘッダにその値が存在するかをテストしています。
      .expect(/<a href="\/auth\/github"/)                   //expect 関数に、正規表現を一つ渡すと、 HTML の body 内にその正規表現が含まれるかをテストします。
      .expect(200, done);                                   //テストを終了する際には、 expect 関数に、期待されるステータスコードの整数と、テスト自体の引数に渡される done 関数を渡します。
  });

  // ログイン後、その HTML の body 内に、 testuser という文字列が含まれることをテストしています。
  it('ログイン時はユーザー名が表示される',(done)=>{
    request(app)
      .get('/login')
      .expect(/testuser/)
      .expect(200, done);
  });

});

describe('/logout',()=>{
  it('/logoutにアクセスすると / にリダイレクトされる',(done)=>{
    request(app)
      .get('/logout')
      .expect('Location', '/')
      .expect(302, done);
  })
});

describe('/schedules', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定が作成でき、表示される', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト予定1', memo: 'テストメモ1\r\nテストメモ2', candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3' })
        .expect('Location', /schedules/)
        .expect(302)
        .end((err, res) => {
          let createdSchedulePath = res.headers.location;
          request(app)
            .get(createdSchedulePath)
            .expect(/テスト予定1/)  //.expect(/${文字列}/) とかくことで、引数に指定した正規表現の文字列がレスポンスに含まれる場合はテストを成功させ、含まれない場合はテストを失敗させれる
            .expect(/テストメモ1/)
            .expect(/テストメモ2/)
            .expect(/テスト候補1/)
            .expect(/テスト候補2/)
            .expect(/テスト候補3/)
            .expect(200)
            .end((err, res) => { deleteScheduleAggregate(createdSchedulePath.split('/schedules/')[1], done, err);});
        });
    });
  });

});

describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('出欠が更新できる', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト出欠更新予定1', memo: 'テスト出欠更新メモ1', candidates: 'テスト出欠更新候補1' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          Candidate.findOne({
            where: { scheduleId: scheduleId }
          }).then((candidate) => {
            // 更新がされることをテスト
            request(app)
              .post(`/schedules/${scheduleId}/users/${0}/candidates/${candidate.candidateId}`)
              .send({ availability: 2 }) // 出席に更新
              .expect('{"status":"OK","availability":2}')        //webapiの返り値が想定通りか
              .end((err, res) => { 
                Availability.findAll({
                  where: { scheduleId: scheduleId }
                }).then((availabilities)=>{
                  assert(availabilities.length, 1);              //ちゃんとdbに保存されているか
                  assert(availabilities[0].availability, 2);     //ちゃんとdbに想定通りの値が保存されているか
                  deleteScheduleAggregate(scheduleId, done, err); 
                });
              });
          });
        });
    });
  });
});

describe('/schedules/:scheduleId/users/:userId/comments', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('コメントが更新できる', (done)=>{
    User.upsert({
      userId: 0,
      username: 'testuser'
    }).then(()=>{
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テストコメント更新予定1', memo: 'テストコメント更新メモ1', candidates: 'テストコメント更新候補1' })
        .end((err, res)=>{
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          // 更新がされることをテスト
          request(app)
            .post(`/schedules/${scheduleId}/users/${0}/comments`)
            .send({ comment: 'testcomment' })
            .expect('{"status":"OK","comment":"testcomment"}')          //webapiの返り値のjsonが想定通りな事
            .end((err, res)=>{
              Comment.findAll({
                where: { scheduleId: scheduleId }
              }).then((comments)=>{
                assert.equal(comments.length, 1);                       //ちゃんとdbに保存されている事
                assert.equal(comments[0].comment, 'testcomment');       //dbに保存されてる内容も想定通りな事
                deleteScheduleAggregate(scheduleId, done, err);
              });
            });
        });
    });
  });

});

describe('/schedules/:scheduleId?edit=1', ()=>{
  before(()=>{
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser'});
  });

  after(()=>{
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定が更新でき、候補が追加できる', (done)=>{
    User.upsert({ 
      userId:0, 
      username: 'testuser'
     }).then(()=>{
      request(app)
        //まず、編集するための元のスケジュールを作る
        .post('/schedules')
        .send({ scheduleName: 'テスト更新予定1', memo: 'テスト更新メモ1', candidates: 'テスト更新候補1' })
        .end((req, res)=>{
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          //更新がされることをテスト
          request(app)
            .post(`/schedules/${scheduleId}?edit=1`)
            .send({ scheduleName: 'テスト更新予定2', memo: 'テスト更新メモ2', candidates: 'テスト更新候補2' })
            .end((err, res)=>{
              //スケジュールがちゃんと更新されているか
              Schedule.findById(scheduleId).then((s)=>{
                assert.equal(s.scheduleName, 'テスト更新予定2');
                assert.equal(s.memo, 'テスト更新メモ2');
              });
              //候補がちゃんと更新されているか
              Candidate.findAll({
                where: { scheduleId: scheduleId }
              }).then((candidates) => {
                assert.equal(candidates.length, 2);
                assert.equal(candidates[0].candidateName, 'テスト更新候補1');
                assert.equal(candidates[1].candidateName, 'テスト更新候補2');
                deleteScheduleAggregate(scheduleId, done, err);              
              });
            });
        });
    });
  });
});

describe('/schedules/:scheduleId?delete=1', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定に関連する全ての情報が削除できる', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト更新予定1', memo: 'テスト更新メモ1', candidates: 'テスト更新候補1' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];

          // 出欠作成のプロミスを作成
          const promiseAvailability = Candidate.findOne({
            where: { scheduleId: scheduleId }
          }).then((candidate) => {
            return new Promise((resolve) => {
              request(app)
                .post(`/schedules/${scheduleId}/users/${0}/candidates/${candidate.candidateId}`)
                .send({ availability: 2 }) // 出席に更新
                .end((err, res) => {
                  if (err) done(err);
                  resolve();
                });
            });
          });

          // コメント作成のプロミスを作成
          const promiseComment = new Promise((resolve) => {
            request(app)
              .post(`/schedules/${scheduleId}/users/${0}/comments`)
              .send({ comment: 'testcomment' })
              .expect('{"status":"OK","comment":"testcomment"}')
              .end((err, res) => {
                if (err) done(err);
                resolve();
              });
          });

          // 削除を実行するプロミスの作成
          const promiseDeleted = Promise.all([promiseAvailability, promiseComment]).then(() => { //出欠作成とコメント作成が終わったら
            return new Promise((resolve) => {                                                    //削除を実行するプロミスを返す
              request(app)
                .post(`/schedules/${scheduleId}?delete=1`)
                .end((err, res) => {
                  if (err) done(err);
                  resolve();
                });
            });
          });

          // テスト
          promiseDeleted.then(() => {             //削除を実行
            //削除後、ちゃんと削除されているか確認
            const p1 = Comment.findAll({
              where: { scheduleId: scheduleId }
            }).then((comments) => {
              assert.equal(comments.length, 0);
            });
            const p2 = Availability.findAll({
              where: { scheduleId: scheduleId }
            }).then((availabilities) => {
              assert.equal(availabilities.length, 0);
            });
            const p3 = Candidate.findAll({
              where: { scheduleId: scheduleId }
            }).then((candidates) => {
              assert.equal(candidates.length, 0);
            });
            const p4 = Schedule.findById(scheduleId)
              .then((schedule) => {
                assert.equal(!schedule, true);  //schedule が null であることをテスト
            });
            Promise.all([p1, p2, p3, p4]).then(() => {
              if (err) return done(err);
              done();
            });
          });
        });
    });
  });
});
